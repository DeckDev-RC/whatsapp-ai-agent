import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WAMessage,
  WASocket,
  isJidGroup,
  AnyMessageContent,
  ConnectionState,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import type { WhatsAppConnection, MessageContext, GroupInfo, ChatInfo, TypingIndicator } from '../../shared/types';

// ============================================
// WHATSAPP MANAGER - Baileys Integration (v2)
// Completely rewritten for robust connection
// ============================================

const AUTH_FOLDER = path.join(process.cwd(), 'auth_info_baileys');

// Silenced logger for Baileys
const logger = pino({ level: 'silent' });

enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  QR_CODE_READY = 'qr',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export class WhatsAppManager {
  private sock: WASocket | null = null;
  private qrCode: string | null = null;
  private isConnected = false;
  private phoneNumber: string | null = null;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private statusMessage: string = 'Desconectado';
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // Callbacks
  private messageCallback: ((context: MessageContext) => void) | null = null;
  private statusUpdateCallback: ((status: WhatsAppConnection) => void) | null = null;
  private typingCallback: ((indicator: TypingIndicator) => void) | null = null;

  // Tracking
  private groups: Map<string, GroupInfo> = new Map();
  private privateChats: Map<string, ChatInfo> = new Map();

  constructor() {
    this.log('WhatsApp Manager (Baileys v2) initialized');
    // Ensure auth folder exists
    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }
  }

  private log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    if (data !== undefined) {
      console.log(`[${timestamp}] WhatsApp: ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    } else {
      console.log(`[${timestamp}] WhatsApp: ${message}`);
    }
  }

  private setStatus(status: ConnectionStatus, message: string) {
    this.connectionStatus = status;
    this.statusMessage = message;
    this.log(`Status: ${status} - ${message}`);
    this.notifyStatusUpdate();
  }

  private notifyStatusUpdate() {
    if (this.statusUpdateCallback) {
      const status: WhatsAppConnection = {
        isConnected: this.isConnected,
        qrCode: this.qrCode || undefined,
        phoneNumber: this.phoneNumber || undefined,
        status: this.connectionStatus as 'disconnected' | 'connecting' | 'connected' | 'qr',
        statusMessage: this.statusMessage,
      };
      this.statusUpdateCallback(status);
    }
  }

  /**
   * Check if saved credentials exist
   */
  async hasSavedCredentials(): Promise<boolean> {
    try {
      if (fs.existsSync(AUTH_FOLDER)) {
        const files = fs.readdirSync(AUTH_FOLDER);
        const credsFile = path.join(AUTH_FOLDER, 'creds.json');
        return fs.existsSync(credsFile) && fs.statSync(credsFile).size > 0;
      }
      return false;
    } catch (error) {
      this.log('Error checking credentials:', error);
      return false;
    }
  }

  /**
   * Auto-connect if credentials exist
   */
  async autoConnect(): Promise<void> {
    try {
      const hasCreds = await this.hasSavedCredentials();
      if (hasCreds && !this.isConnected && !this.isConnecting) {
        this.log('🔄 Credentials found, auto-connecting...');
        await this.connect();
      } else if (!hasCreds) {
        this.log('ℹ️ No saved credentials. Manual connection required.');
      }
    } catch (error) {
      this.log('Auto-connect error:', error);
    }
  }

  /**
   * Main connection method - completely rewritten
   */
  async connect(): Promise<void> {
    // Prevent multiple simultaneous connections
    if (this.isConnecting) {
      this.log('⚠️ Connection already in progress');
      return;
    }

    if (this.isConnected && this.sock) {
      this.log('✅ Already connected');
      return;
    }

    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isConnecting = true;
    this.setStatus(ConnectionStatus.CONNECTING, 'Iniciando conexão...');

    try {
      this.log('🚀 Starting Baileys connection...');

      // Setup auth state
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

      // Fetch latest version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.log(`Using Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);

      // Create socket with robust configuration
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: true, // Also print in terminal for debugging
        logger,
        browser: Browsers.ubuntu('Chrome'), // Use standard browser signature
        markOnlineOnConnect: false, // Don't mark online immediately
        syncFullHistory: false, // Don't sync full history
        connectTimeoutMs: 60000, // 60 second timeout
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000, // Keep alive every 30 seconds
        emitOwnEvents: false,
        fireInitQueries: true,
        generateHighQualityLinkPreview: false,
        getMessage: async (key) => {
          // Return empty message for retry
          return { conversation: '' };
        },
      });

      // Handle connection updates
      this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        await this.handleConnectionUpdate(update, saveCreds);
      });

      // Save credentials on update
      this.sock.ev.on('creds.update', saveCreds);

      // Setup message handlers
      this.setupMessageHandler();
      this.setupTypingHandler();

      this.log('✅ Socket created and handlers configured');

    } catch (error: any) {
      this.log('❌ Connection error:', error.message);
      this.setStatus(ConnectionStatus.ERROR, `Error: ${error.message}`);
      this.isConnecting = false;
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Handle connection state updates
   */
  private async handleConnectionUpdate(update: Partial<ConnectionState>, saveCreds: () => Promise<void>) {
    const { connection, lastDisconnect, qr } = update;

    this.log('📡 Connection update:', { connection, hasQR: !!qr, lastDisconnect: lastDisconnect?.error?.message });

    // QR Code generated
    if (qr) {
      try {
        this.qrCode = await qrcode.toDataURL(qr, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        this.setStatus(ConnectionStatus.QR_CODE_READY, 'QR Code pronto - Escaneie com WhatsApp');
        this.log('📱 QR Code generated successfully');
        this.reconnectAttempts = 0; // Reset attempts when QR is shown
      } catch (error) {
        this.log('Error generating QR:', error);
      }
    }

    // Connection opened
    if (connection === 'open') {
      this.log('✅ Connection OPEN!');
      this.isConnected = true;
      this.isConnecting = false;
      this.qrCode = null;
      this.reconnectAttempts = 0;

      // Get phone number
      if (this.sock?.user) {
        this.phoneNumber = this.sock.user.id.split(':')[0].replace('@s.whatsapp.net', '');
        this.log(`📱 Connected as: ${this.phoneNumber}`);
      }

      this.setStatus(ConnectionStatus.CONNECTED, 'Conectado com sucesso');

      // Load groups and chats
      try {
        await this.loadGroupsAndChats();
      } catch (e) {
        this.log('Error loading groups:', e);
      }
    }

    // Connection closed
    if (connection === 'close') {
      this.isConnecting = false;
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const errorMessage = (lastDisconnect?.error as Boom)?.message || 'Unknown error';

      this.log(`❌ Connection closed - Code: ${statusCode}, Message: ${errorMessage}`);

      // Handle different disconnect reasons
      if (statusCode === DisconnectReason.loggedOut) {
        // User logged out - clear credentials and don't reconnect
        this.log('🚪 Logged out by user');
        await this.clearAuth();
        this.handleDisconnected();
      } else if (statusCode === DisconnectReason.restartRequired) {
        // Restart required - reconnect immediately
        this.log('🔄 Restart required');
        this.scheduleReconnect(1000);
      } else if (statusCode === DisconnectReason.connectionClosed ||
        statusCode === DisconnectReason.connectionLost ||
        statusCode === DisconnectReason.timedOut) {
        // Network issues - reconnect with backoff
        this.log('📡 Network issue, will reconnect...');
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.badSession) {
        // Bad session - clear and reconnect
        this.log('⚠️ Bad session, clearing credentials...');
        await this.clearAuth();
        this.scheduleReconnect(2000);
      } else if (statusCode === 515) {
        // Stream error - wait longer before reconnect
        this.log('⚠️ Stream error (515), waiting before reconnect...');
        this.scheduleReconnect(10000);
      } else {
        // Other errors - try to reconnect
        this.log(`⚠️ Disconnect code ${statusCode}, will try to reconnect...`);
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Schedule a reconnection with exponential backoff
   */
  private scheduleReconnect(delayMs?: number) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('❌ Max reconnection attempts reached');
      this.setStatus(ConnectionStatus.ERROR, 'Falha na conexão após várias tentativas');
      this.handleDisconnected();
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff: 3s, 6s, 12s, 24s, 48s
    const delay = delayMs || Math.min(3000 * Math.pow(2, this.reconnectAttempts - 1), 60000);

    this.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.setStatus(ConnectionStatus.CONNECTING, `Reconectando em ${Math.round(delay / 1000)}s...`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        // Cleanup old socket
        if (this.sock) {
          this.sock.ev.removeAllListeners();
          this.sock = null;
        }
        this.isConnecting = false;
        await this.connect();
      } catch (error) {
        this.log('Reconnection failed:', error);
      }
    }, delay);
  }

  private handleDisconnected() {
    this.isConnected = false;
    this.isConnecting = false;
    this.phoneNumber = null;
    this.qrCode = null;
    this.groups.clear();
    this.privateChats.clear();
    this.reconnectAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.setStatus(ConnectionStatus.DISCONNECTED, 'Desconectado');
  }

  private setupMessageHandler(): void {
    if (!this.sock) return;

    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          await this.processMessage(msg);
        } catch (error) {
          this.log('Error processing message:', error);
        }
      }
    });

    this.log('✅ Message handler configured');
  }

  private setupTypingHandler(): void {
    if (!this.sock) return;

    this.sock.ev.on('presence.update', async ({ id, presences }) => {
      try {
        if (!id) return;

        const isGroup = id.includes('@g.us');
        const chatId = id;

        for (const [participantId, presence] of Object.entries(presences)) {
          const presenceValue = String(presence || '');
          const isTyping = presenceValue === 'composing' || presenceValue === 'recording';

          if (isTyping || presenceValue === 'available' || presenceValue === 'unavailable') {
            const indicator: TypingIndicator = {
              chatId,
              from: isGroup ? participantId : chatId,
              isTyping,
              participant: isGroup ? participantId : undefined,
              timestamp: new Date(),
            };

            if (this.typingCallback) {
              this.typingCallback(indicator);
            }
          }
        }
      } catch (error) {
        this.log('Error processing typing indicator:', error);
      }
    });

    this.log('✅ Typing handler configured');
  }

  private async processMessage(msg: WAMessage): Promise<void> {
    // Ignore own messages
    if (msg.key.fromMe) return;

    const chatId = msg.key.remoteJid!;
    const isGroup = isJidGroup(chatId);

    // Detect message type
    let messageText = '';
    let hasMedia = false;
    let mediaType: 'audio' | 'image' | 'video' | 'document' | undefined;
    let mediaBuffer: Buffer | undefined;
    let mimetype: string | undefined;

    messageText =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      '';

    if (msg.message?.audioMessage) {
      hasMedia = true;
      mediaType = 'audio';
      mimetype = msg.message.audioMessage.mimetype || 'audio/ogg; codecs=opus';
    }

    if (msg.message?.imageMessage) {
      hasMedia = true;
      mediaType = 'image';
      mimetype = msg.message.imageMessage.mimetype || 'image/jpeg';
    }

    if (msg.message?.videoMessage) {
      hasMedia = true;
      mediaType = 'video';
      mimetype = msg.message.videoMessage.mimetype || 'video/mp4';
    }

    if (msg.message?.documentMessage) {
      hasMedia = true;
      mediaType = 'document';
      mimetype = msg.message.documentMessage.mimetype || 'application/octet-stream';
    }

    if (!messageText && !hasMedia) return;

    let from: string;
    if (isGroup) {
      from = msg.key.participant || chatId;
    } else {
      from = chatId;
    }

    const context: MessageContext = {
      from,
      chatId,
      isGroup: isGroup === true,
      message: messageText || '[Mídia]',
      timestamp: new Date((msg.messageTimestamp as number) * 1000),
      messageId: msg.key.id || undefined,
      hasMedia,
      mediaType,
      mediaBuffer,
      mimetype,
      rawMessage: hasMedia ? msg : undefined,
    };

    if (isGroup) {
      const groupInfo = this.groups.get(chatId);
      context.groupName = groupInfo?.name || 'Grupo';
      context.participant = msg.key.participant || undefined;
    } else {
      this.updatePrivateChat(from, messageText || '[Mídia]');
    }

    if (this.messageCallback) {
      this.messageCallback(context);
    }
  }

  private updatePrivateChat(chatId: string, lastMessage: string): void {
    const existing = this.privateChats.get(chatId);
    this.privateChats.set(chatId, {
      id: chatId,
      phone: chatId.replace('@s.whatsapp.net', '').replace('@lid', ''),
      name: existing?.name,
      isGroup: false,
      lastMessage,
      lastMessageTime: new Date(),
    });
  }

  private async loadGroupsAndChats(): Promise<void> {
    if (!this.sock) return;

    try {
      this.log('📋 Loading groups...');
      const groups = await this.sock.groupFetchAllParticipating();

      this.groups.clear();
      for (const [id, group] of Object.entries(groups)) {
        this.groups.set(id, {
          id,
          name: group.subject,
          participants: group.participants.length,
          description: group.desc,
          createdAt: new Date((group.creation || 0) * 1000),
        });
      }

      this.log(`✅ ${this.groups.size} groups loaded`);
    } catch (error) {
      this.log('⚠️ Error loading groups:', error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.log('🔌 Disconnecting...');

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (e) {
          // Ignore logout errors
        }
        this.sock.ev.removeAllListeners();
        this.sock = null;
      }

      this.handleDisconnected();
      this.log('✅ Disconnected');
    } catch (error) {
      this.log('❌ Disconnect error:', error);
      this.handleDisconnected();
    }
  }

  async clearAuth(): Promise<void> {
    try {
      this.log('━'.repeat(40));
      this.log('🗑️ CLEARING CREDENTIALS');
      this.log('━'.repeat(40));

      // Stop any reconnection attempts
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // Disconnect socket
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          await this.sock.logout().catch(() => { });
        } catch (e) {
          // Ignore
        }
        this.sock = null;
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Remove auth folder
      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        this.log('✅ Auth folder removed');
      }

      // Recreate empty folder
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });

      this.handleDisconnected();
      this.log('✅ CREDENTIALS CLEARED');
      this.log('━'.repeat(40));
    } catch (error) {
      this.log('❌ Error clearing credentials:', error);
      throw error;
    }
  }

  async sendTyping(to: string, isTyping: boolean): Promise<void> {
    try {
      if (!this.sock || !this.isConnected) return;

      let jid = to;
      if (!to.includes('@')) {
        const cleanPhone = to.replace(/\D/g, '');
        jid = `${cleanPhone}@s.whatsapp.net`;
      }

      if (to.includes('@lid')) return;

      await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);
    } catch (error) {
      // Silent fail
    }
  }

  async sendMessage(to: string, message: string | AnyMessageContent): Promise<void> {
    try {
      if (!this.sock || !this.isConnected) {
        throw new Error('WhatsApp not connected');
      }

      let jid = to;
      if (!to.includes('@')) {
        const cleanPhone = to.replace(/\D/g, '');
        jid = `${cleanPhone}@s.whatsapp.net`;
      }

      const content = typeof message === 'string' ? { text: message } : message;
      await this.sock.sendMessage(jid, content);

      this.log(`✅ Message sent to: ${to}`);
    } catch (error: any) {
      this.log('❌ Send message error:', error.message);
      throw error;
    }
  }

  // Callbacks
  onMessage(callback: (context: MessageContext) => void): void {
    this.messageCallback = callback;
  }

  onStatusUpdate(callback: (status: WhatsAppConnection) => void): void {
    this.statusUpdateCallback = callback;
    this.notifyStatusUpdate();
  }

  onTyping(callback: (indicator: TypingIndicator) => void): void {
    this.typingCallback = callback;
  }

  // Status
  getStatus(): WhatsAppConnection {
    let status: 'disconnected' | 'connecting' | 'qr' | 'connected' = 'disconnected';

    switch (this.connectionStatus) {
      case ConnectionStatus.CONNECTED:
        status = 'connected';
        break;
      case ConnectionStatus.QR_CODE_READY:
        status = 'qr';
        break;
      case ConnectionStatus.CONNECTING:
        status = 'connecting';
        break;
      default:
        status = 'disconnected';
    }

    return {
      isConnected: this.isConnected,
      qrCode: this.qrCode || undefined,
      phoneNumber: this.phoneNumber || undefined,
      status,
      statusMessage: this.statusMessage,
    };
  }

  async getGroups(): Promise<GroupInfo[]> {
    return Array.from(this.groups.values());
  }

  async getChats(): Promise<ChatInfo[]> {
    return Array.from(this.privateChats.values());
  }

  async getContacts(): Promise<Array<{
    id: string;
    phone: string;
    name?: string;
    pushName?: string;
    isGroup: boolean;
  }>> {
    const contacts: Array<{
      id: string;
      phone: string;
      name?: string;
      pushName?: string;
      isGroup: boolean;
    }> = [];

    for (const group of this.groups.values()) {
      contacts.push({
        id: group.id,
        phone: group.id,
        name: group.name,
        isGroup: true,
      });
    }

    for (const chat of this.privateChats.values()) {
      contacts.push({
        id: chat.id,
        phone: chat.phone,
        name: chat.name,
        isGroup: false,
      });
    }

    return contacts;
  }
}

export const whatsappManager = new WhatsAppManager();
