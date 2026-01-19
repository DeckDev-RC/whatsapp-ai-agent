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
  delay,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import type { WhatsAppConnection, MessageContext, GroupInfo, ChatInfo, TypingIndicator } from '../../shared/types';

// ============================================
// WHATSAPP MANAGER - Baileys Integration (v4)
// Robust connection with retry limits
// ============================================

const AUTH_FOLDER = path.join(process.cwd(), 'auth_info_baileys');
const baileysLogger = pino({ level: 'silent' });

// Connection configuration
const MAX_RETRIES = 10;
const RETRY_DELAY_BASE = 5000; // 5 seconds base
const MAX_RETRY_DELAY = 60000; // 60 seconds max

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
  private retryCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  // Callbacks
  private messageCallback: ((context: MessageContext) => void) | null = null;
  private statusUpdateCallback: ((status: WhatsAppConnection) => void) | null = null;
  private typingCallback: ((indicator: TypingIndicator) => void) | null = null;

  // Tracking
  private groups: Map<string, GroupInfo> = new Map();
  private privateChats: Map<string, ChatInfo> = new Map();

  constructor() {
    this.log('WhatsApp Manager (v4 - stable) initialized');
    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }
  }

  private log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    if (data !== undefined) {
      console.log(`[${timestamp}] WA: ${message}`, typeof data === 'object' ? JSON.stringify(data) : data);
    } else {
      console.log(`[${timestamp}] WA: ${message}`);
    }
  }

  private setStatus(status: ConnectionStatus, message: string) {
    this.connectionStatus = status;
    this.statusMessage = message;
    this.notifyStatusUpdate();
  }

  private notifyStatusUpdate() {
    if (this.statusUpdateCallback) {
      this.statusUpdateCallback({
        isConnected: this.isConnected,
        qrCode: this.qrCode || undefined,
        phoneNumber: this.phoneNumber || undefined,
        status: this.connectionStatus as 'disconnected' | 'connecting' | 'connected' | 'qr',
        statusMessage: this.statusMessage,
      });
    }
  }

  async hasSavedCredentials(): Promise<boolean> {
    try {
      const credsFile = path.join(AUTH_FOLDER, 'creds.json');
      return fs.existsSync(credsFile) && fs.statSync(credsFile).size > 0;
    } catch {
      return false;
    }
  }

  async autoConnect(): Promise<void> {
    const hasCreds = await this.hasSavedCredentials();
    if (hasCreds && !this.isConnected && !this.isConnecting) {
      this.log('🔄 Auto-connecting with saved credentials...');
      await this.connect();
    }
  }

  /**
   * Stop any pending reconnection
   */
  private stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Schedule a reconnection with exponential backoff
   */
  private scheduleReconnect() {
    if (!this.shouldReconnect) {
      this.log('Reconnection disabled');
      return;
    }

    if (this.retryCount >= MAX_RETRIES) {
      this.log(`❌ Max retries (${MAX_RETRIES}) reached. Stopping reconnection.`);
      this.setStatus(ConnectionStatus.ERROR, `Falha após ${MAX_RETRIES} tentativas. Clique para reconectar.`);
      this.retryCount = 0;
      return;
    }

    this.retryCount++;

    // Exponential backoff with jitter
    const delayMs = Math.min(
      RETRY_DELAY_BASE * Math.pow(1.5, this.retryCount - 1) + Math.random() * 2000,
      MAX_RETRY_DELAY
    );

    this.log(`🔄 Retry ${this.retryCount}/${MAX_RETRIES} in ${Math.round(delayMs / 1000)}s`);
    this.setStatus(ConnectionStatus.CONNECTING, `Tentativa ${this.retryCount}/${MAX_RETRIES} em ${Math.round(delayMs / 1000)}s...`);

    this.stopReconnect();
    this.reconnectTimer = setTimeout(async () => {
      this.isConnecting = false;
      await this.connect();
    }, delayMs);
  }

  /**
   * Main connection method
   */
  async connect(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    if (this.isConnected && this.sock) {
      this.log('✅ Already connected');
      return;
    }

    this.stopReconnect();
    this.isConnecting = true;
    this.shouldReconnect = true;
    this.setStatus(ConnectionStatus.CONNECTING, 'Conectando...');

    try {
      // Cleanup old socket
      if (this.sock) {
        try { this.sock.end(undefined); } catch { }
        this.sock = null;
      }

      // Small delay before connecting
      await delay(1000);

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      const { version } = await fetchLatestBaileysVersion();

      this.log(`📡 Connecting with Baileys v${version.join('.')}`);

      this.sock = makeWASocket({
        version,
        logger: baileysLogger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 2000,
        qrTimeout: 40000,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        getMessage: async () => proto.Message.fromObject({}),
      });

      // Connection event handler
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code
        if (qr) {
          this.retryCount = 0; // Reset retries when QR appears
          try {
            this.qrCode = await qrcode.toDataURL(qr, { width: 256, margin: 2 });
            this.setStatus(ConnectionStatus.QR_CODE_READY, 'Escaneie o QR Code');
            this.log('📱 QR Code ready');
          } catch (e) {
            this.log('QR generation error:', e);
          }
        }

        // Connection opened
        if (connection === 'open') {
          this.log('✅ CONNECTED!');
          this.isConnected = true;
          this.isConnecting = false;
          this.qrCode = null;
          this.retryCount = 0;

          if (this.sock?.user) {
            this.phoneNumber = this.sock.user.id.split(':')[0].replace('@s.whatsapp.net', '');
            this.log(`📱 Phone: ${this.phoneNumber}`);
          }

          this.setStatus(ConnectionStatus.CONNECTED, 'Conectado');

          try {
            await this.loadGroupsAndChats();
          } catch (e) {
            this.log('Groups load error:', e);
          }
        }

        // Connection closed
        if (connection === 'close') {
          this.isConnecting = false;
          this.isConnected = false;

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const reason = DisconnectReason;

          this.log(`❌ Disconnected: ${statusCode}`);

          // Handle specific disconnect reasons
          switch (statusCode) {
            case reason.loggedOut:
              this.log('🚪 Logged out');
              this.shouldReconnect = false;
              await this.clearAuth();
              this.handleDisconnected();
              break;

            case reason.restartRequired:
              this.log('🔄 Restart required');
              this.retryCount = 0;
              this.scheduleReconnect();
              break;

            case reason.badSession:
              this.log('⚠️ Bad session, clearing...');
              await this.clearAuth();
              this.retryCount = 0;
              this.scheduleReconnect();
              break;

            default:
              // For all other errors (408, 515, etc), schedule reconnect
              this.scheduleReconnect();
              break;
          }
        }
      });

      // Credentials update
      this.sock.ev.on('creds.update', saveCreds);

      // Messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
          for (const msg of messages) {
            try {
              await this.processMessage(msg);
            } catch (e) {
              this.log('Message error:', e);
            }
          }
        }
      });

      // Presence
      this.sock.ev.on('presence.update', (presence) => {
        this.handlePresenceUpdate(presence);
      });

      this.log('✅ Socket initialized');

    } catch (error: any) {
      this.log('❌ Connection error:', error.message);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private handlePresenceUpdate(presence: any) {
    const { id, presences } = presence;
    if (!id || !presences) return;

    const isGroup = id.includes('@g.us');

    for (const [participantId, presenceData] of Object.entries(presences)) {
      const presenceValue = String((presenceData as any)?.lastKnownPresence || '');
      const isTyping = presenceValue === 'composing' || presenceValue === 'recording';

      if (this.typingCallback) {
        this.typingCallback({
          chatId: id,
          from: isGroup ? participantId : id,
          isTyping,
          participant: isGroup ? participantId : undefined,
          timestamp: new Date(),
        });
      }
    }
  }

  private handleDisconnected() {
    this.isConnected = false;
    this.isConnecting = false;
    this.phoneNumber = null;
    this.qrCode = null;
    this.sock = null;
    this.retryCount = 0;
    this.stopReconnect();
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

    if (msg.message?.audioMessage) { hasMedia = true; mediaType = 'audio'; mimetype = msg.message.audioMessage.mimetype || 'audio/ogg'; }
    if (msg.message?.imageMessage) { hasMedia = true; mediaType = 'image'; mimetype = msg.message.imageMessage.mimetype || 'image/jpeg'; }
    if (msg.message?.videoMessage) { hasMedia = true; mediaType = 'video'; mimetype = msg.message.videoMessage.mimetype || 'video/mp4'; }
    if (msg.message?.documentMessage) { hasMedia = true; mediaType = 'document'; mimetype = msg.message.documentMessage.mimetype || 'application/octet-stream'; }

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
    this.privateChats.set(chatId, {
      id: chatId,
      phone: chatId.replace('@s.whatsapp.net', '').replace('@lid', ''),
      name: this.privateChats.get(chatId)?.name,
      isGroup: false,
      lastMessage,
      lastMessageTime: new Date(),
    });
  }

  private async loadGroupsAndChats(): Promise<void> {
    if (!this.sock) return;

    try {
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
    } catch (e) {
      this.log('Groups error:', e);
    }
  }

  async disconnect(): Promise<void> {
    this.log('🔌 Disconnecting...');
    this.shouldReconnect = false;
    this.stopReconnect();

    if (this.sock) {
      try { await this.sock.logout(); } catch { }
      try { this.sock.end(undefined); } catch { }
      this.sock = null;
    }

    this.handleDisconnected();
    this.log('✅ Disconnected');
  }

  async clearAuth(): Promise<void> {
    this.log('🗑️ Clearing credentials...');
    this.shouldReconnect = false;
    this.stopReconnect();

    if (this.sock) {
      try { this.sock.end(undefined); } catch { }
      this.sock = null;
    }

    await delay(500);

    if (fs.existsSync(AUTH_FOLDER)) {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
    }
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });

    this.handleDisconnected();
    this.log('✅ Credentials cleared');
  }

  async sendTyping(to: string, isTyping: boolean): Promise<void> {
    if (!this.sock || !this.isConnected) return;
    try {
      let jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
      if (to.includes('@lid')) return;
      await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);
    } catch { }
  }

  async sendMessage(to: string, message: string | AnyMessageContent): Promise<void> {
    if (!this.sock || !this.isConnected) throw new Error('WhatsApp not connected');

    let jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
    const content = typeof message === 'string' ? { text: message } : message;
    await this.sock.sendMessage(jid, content);
    this.log(`✅ Sent to: ${to}`);
  }

  onMessage(callback: (context: MessageContext) => void): void { this.messageCallback = callback; }
  onStatusUpdate(callback: (status: WhatsAppConnection) => void): void { this.statusUpdateCallback = callback; this.notifyStatusUpdate(); }
  onTyping(callback: (indicator: TypingIndicator) => void): void { this.typingCallback = callback; }

  getStatus(): WhatsAppConnection {
    return {
      isConnected: this.isConnected,
      qrCode: this.qrCode || undefined,
      phoneNumber: this.phoneNumber || undefined,
      status: this.connectionStatus as 'disconnected' | 'connecting' | 'connected' | 'qr',
      statusMessage: this.statusMessage,
    };
  }

  async getGroups(): Promise<GroupInfo[]> { return Array.from(this.groups.values()); }
  async getChats(): Promise<ChatInfo[]> { return Array.from(this.privateChats.values()); }
  async getContacts(): Promise<Array<{ id: string; phone: string; name?: string; isGroup: boolean; }>> {
    const contacts: Array<{ id: string; phone: string; name?: string; isGroup: boolean; }> = [];
    for (const g of this.groups.values()) contacts.push({ id: g.id, phone: g.id, name: g.name, isGroup: true });
    for (const c of this.privateChats.values()) contacts.push({ id: c.id, phone: c.phone, name: c.name, isGroup: false });
    return contacts;
  }
}

export const whatsappManager = new WhatsAppManager();
