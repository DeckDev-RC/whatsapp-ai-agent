import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WAMessage,
  WASocket,
  isJidGroup,
  AnyMessageContent,
  Browsers,
  WAMessageKey,
  WAMessageContent,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import type { WhatsAppConnection, MessageContext, GroupInfo, ChatInfo, TypingIndicator } from '../../shared/types';

// ============================================
// WHATSAPP MANAGER - Baileys Integration (v3)
// Following official Baileys example pattern
// ============================================

const AUTH_FOLDER = path.join(process.cwd(), 'auth_info_baileys');

// Logger configuration
const baileysLogger = pino({ level: 'silent' });

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

  // Callbacks
  private messageCallback: ((context: MessageContext) => void) | null = null;
  private statusUpdateCallback: ((status: WhatsAppConnection) => void) | null = null;
  private typingCallback: ((indicator: TypingIndicator) => void) | null = null;

  // Tracking
  private groups: Map<string, GroupInfo> = new Map();
  private privateChats: Map<string, ChatInfo> = new Map();

  constructor() {
    this.log('WhatsApp Manager (Baileys v3) initialized');
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
      const credsFile = path.join(AUTH_FOLDER, 'creds.json');
      return fs.existsSync(credsFile) && fs.statSync(credsFile).size > 0;
    } catch {
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
   * Main connection method - following official example
   */
  async connect(): Promise<void> {
    if (this.isConnecting) {
      this.log('⚠️ Connection already in progress');
      return;
    }

    if (this.isConnected && this.sock) {
      this.log('✅ Already connected');
      return;
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

      // Create socket - following official example pattern
      this.sock = makeWASocket({
        version,
        logger: baileysLogger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: false,
        // Implement getMessage for retry handling
        getMessage: this.getMessage.bind(this),
      });

      // Use sock.ev.process() pattern like official example
      this.sock.ev.process(async (events) => {
        // Connection update
        if (events['connection.update']) {
          const update = events['connection.update'];
          const { connection, lastDisconnect, qr } = update;

          this.log('📡 Connection event:', { connection, hasQR: !!qr });

          // QR Code received
          if (qr) {
            try {
              this.qrCode = await qrcode.toDataURL(qr, {
                width: 256,
                margin: 2,
              });
              this.setStatus(ConnectionStatus.QR_CODE_READY, 'QR Code pronto - Escaneie com WhatsApp');
              this.log('📱 QR Code generated');
            } catch (error) {
              this.log('Error generating QR:', error);
            }
          }

          // Connection closed
          if (connection === 'close') {
            this.isConnecting = false;
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const errorMessage = (lastDisconnect?.error as Error)?.message || 'Unknown';

            this.log(`❌ Connection closed - Code: ${statusCode}, Message: ${errorMessage}`);

            // Reconnect if not logged out - following official example
            if (statusCode !== DisconnectReason.loggedOut) {
              this.log('� Reconnecting...');
              // Reset state
              this.sock = null;
              this.isConnected = false;
              this.qrCode = null;
              // Wait a bit before reconnecting
              setTimeout(() => {
                this.isConnecting = false;
                this.connect();
              }, 3000);
            } else {
              this.log('🚪 Logged out - clearing credentials');
              this.handleDisconnected();
            }
          }

          // Connection opened
          if (connection === 'open') {
            this.log('✅ Connection OPEN!');
            this.isConnected = true;
            this.isConnecting = false;
            this.qrCode = null;

            if (this.sock?.user) {
              this.phoneNumber = this.sock.user.id.split(':')[0].replace('@s.whatsapp.net', '');
              this.log(`📱 Connected as: ${this.phoneNumber}`);
            }

            this.setStatus(ConnectionStatus.CONNECTED, 'Conectado com sucesso');

            // Load groups
            try {
              await this.loadGroupsAndChats();
            } catch (e) {
              this.log('Error loading groups:', e);
            }
          }
        }

        // Credentials update
        if (events['creds.update']) {
          await saveCreds();
        }

        // Messages received
        if (events['messages.upsert']) {
          const upsert = events['messages.upsert'];
          if (upsert.type === 'notify') {
            for (const msg of upsert.messages) {
              try {
                await this.processMessage(msg);
              } catch (error) {
                this.log('Error processing message:', error);
              }
            }
          }
        }

        // Presence update (typing)
        if (events['presence.update']) {
          const presence = events['presence.update'];
          try {
            this.handlePresenceUpdate(presence);
          } catch (error) {
            this.log('Error handling presence:', error);
          }
        }
      });

      this.log('✅ Socket created with event processor');

    } catch (error: any) {
      this.log('❌ Connection error:', error.message);
      this.setStatus(ConnectionStatus.ERROR, `Erro: ${error.message}`);
      this.isConnecting = false;
      throw error;
    }
  }

  /**
   * getMessage implementation for retry handling
   */
  private async getMessage(key: WAMessageKey): Promise<WAMessageContent | undefined> {
    // Return empty message for retry - official pattern
    return proto.Message.fromObject({});
  }

  private handlePresenceUpdate(presence: any) {
    const { id, presences } = presence;
    if (!id || !presences) return;

    const isGroup = id.includes('@g.us');

    for (const [participantId, presenceData] of Object.entries(presences)) {
      const presenceValue = String((presenceData as any)?.lastKnownPresence || '');
      const isTyping = presenceValue === 'composing' || presenceValue === 'recording';

      const indicator: TypingIndicator = {
        chatId: id,
        from: isGroup ? participantId : id,
        isTyping,
        participant: isGroup ? participantId : undefined,
        timestamp: new Date(),
      };

      if (this.typingCallback) {
        this.typingCallback(indicator);
      }
    }
  }

  private handleDisconnected() {
    this.isConnected = false;
    this.isConnecting = false;
    this.phoneNumber = null;
    this.qrCode = null;
    this.sock = null;
    this.groups.clear();
    this.privateChats.clear();
    this.setStatus(ConnectionStatus.DISCONNECTED, 'Desconectado');
  }

  private async processMessage(msg: WAMessage): Promise<void> {
    if (msg.key.fromMe) return;

    const chatId = msg.key.remoteJid!;
    const isGroup = isJidGroup(chatId);

    let messageText = '';
    let hasMedia = false;
    let mediaType: 'audio' | 'image' | 'video' | 'document' | undefined;
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
      mimetype = msg.message.audioMessage.mimetype || 'audio/ogg';
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

    const from = isGroup ? (msg.key.participant || chatId) : chatId;

    const context: MessageContext = {
      from,
      chatId,
      isGroup: isGroup === true,
      message: messageText || '[Mídia]',
      timestamp: new Date((msg.messageTimestamp as number) * 1000),
      messageId: msg.key.id || undefined,
      hasMedia,
      mediaType,
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

      if (this.sock) {
        try {
          await this.sock.logout();
        } catch {
          // Ignore
        }
        this.sock.end(undefined);
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

      if (this.sock) {
        try {
          this.sock.end(undefined);
        } catch {
          // Ignore
        }
        this.sock = null;
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        this.log('✅ Auth folder removed');
      }

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
        jid = `${to.replace(/\D/g, '')}@s.whatsapp.net`;
      }

      if (to.includes('@lid')) return;

      await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);
    } catch {
      // Silent fail
    }
  }

  async sendMessage(to: string, message: string | AnyMessageContent): Promise<void> {
    if (!this.sock || !this.isConnected) {
      throw new Error('WhatsApp not connected');
    }

    let jid = to;
    if (!to.includes('@')) {
      jid = `${to.replace(/\D/g, '')}@s.whatsapp.net`;
    }

    const content = typeof message === 'string' ? { text: message } : message;
    await this.sock.sendMessage(jid, content);

    this.log(`✅ Message sent to: ${to}`);
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
