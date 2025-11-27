import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WAMessage,
  WASocket,
  isJidGroup,
  AnyMessageContent,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import type { WhatsAppConnection, MessageContext, GroupInfo, ChatInfo, TypingIndicator } from '../../shared/types';

// ============================================
// WHATSAPP MANAGER - Baileys Integration
// ============================================

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

  // Callbacks
  private messageCallback: ((context: MessageContext) => void) | null = null;
  private statusUpdateCallback: ((status: WhatsAppConnection) => void) | null = null;
  private typingCallback: ((indicator: TypingIndicator) => void) | null = null;

  // Rastreamento
  private groups: Map<string, GroupInfo> = new Map();
  private privateChats: Map<string, ChatInfo> = new Map();

  constructor() {
    this.log('WhatsApp Manager (Baileys) initialized');
  }

  /**
   * Verifica se existem credenciais salvas para auto-conexão
   */
  async hasSavedCredentials(): Promise<boolean> {
    try {
      const authPath = path.join(process.cwd(), 'auth_info_baileys');

      // Verificar se o diretório existe e tem arquivos de credenciais
      if (fs.existsSync(authPath)) {
        const files = fs.readdirSync(authPath);
        // Baileys salva credenciais em arquivos como 'creds.json' e arquivos de chaves
        // Verificar se há pelo menos um arquivo que não seja vazio
        const hasCreds = files.some(file => {
          const filePath = path.join(authPath, file);
          const stats = fs.statSync(filePath);
          return stats.isFile() && stats.size > 0;
        });
        return hasCreds;
      }
      return false;
    } catch (error) {
      this.log('Erro ao verificar credenciais:', error);
      return false;
    }
  }

  /**
   * Tenta conectar automaticamente se houver credenciais salvas
   */
  async autoConnect(): Promise<void> {
    try {
      const hasCreds = await this.hasSavedCredentials();
      if (hasCreds && !this.isConnected) {
        this.log('🔄 Credenciais encontradas, conectando automaticamente...');
        await this.connect();
      } else if (!hasCreds) {
        this.log('ℹ️ Nenhuma credencial salva encontrada. Conecte manualmente.');
      } else {
        this.log('ℹ️ Já conectado.');
      }
    } catch (error) {
      this.log('Erro na auto-conexão:', error);
      // Não lançar erro para não quebrar a inicialização do app
    }
  }

  private log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] WhatsApp Manager: ${message}`, data || '');
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

  // ===== Connection =====
  async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        this.log('Already connected');
        return;
      }

      this.setStatus(ConnectionStatus.CONNECTING, 'Conectando ao WhatsApp...');
      this.log('🚀 Iniciando conexão com Baileys...');

      // Configurar autenticação
      const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
      const { version } = await fetchLatestBaileysVersion();

      // Criar socket
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['WhatsApp AI Agent', 'Chrome', '1.0.0'],
        markOnlineOnConnect: true,
      });

      // Handler de conexão
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCode = await qrcode.toDataURL(qr);
            this.setStatus(ConnectionStatus.QR_CODE_READY, 'QR Code gerado - Escaneie com WhatsApp');
            this.log('📱 QR Code gerado');
          } catch (error) {
            this.log('Erro ao gerar QR Code:', error);
          }
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          this.log('Conexão fechada. Reconectar?', shouldReconnect);

          if (shouldReconnect) {
            this.log('Reconectando...');
            setTimeout(() => this.connect(), 3000);
          } else {
            this.handleDisconnected();
          }
        } else if (connection === 'open') {
          await this.handleConnected();
        }
      });

      // Salvar credenciais
      this.sock.ev.on('creds.update', saveCreds);

      // Handler de mensagens
      this.setupMessageHandler();

      // Handler de indicador de digitação
      this.setupTypingHandler();

      this.log('✅ Socket criado e handlers configurados');
    } catch (error: any) {
      this.log('❌ Erro na conexão:', error.message);
      this.setStatus(ConnectionStatus.ERROR, `Erro: ${error.message}`);
      throw error;
    }
  }

  private async handleConnected() {
    try {
      this.log('✅ Conectado ao WhatsApp!');

      // Obter número de telefone
      if (this.sock?.user) {
        this.phoneNumber = this.sock.user.id.split(':')[0];
        this.log(`📱 Conectado como: ${this.phoneNumber}`);
      }

      this.isConnected = true;
      this.qrCode = null;
      this.setStatus(ConnectionStatus.CONNECTED, 'Conectado com sucesso');

      // Carregar grupos e chats
      await this.loadGroupsAndChats();
    } catch (error) {
      this.log('Erro ao processar conexão:', error);
      this.isConnected = true;
      this.setStatus(ConnectionStatus.CONNECTED, 'Conectado');
    }
  }

  private handleDisconnected() {
    this.isConnected = false;
    this.phoneNumber = null;
    this.qrCode = null;
    this.groups.clear();
    this.privateChats.clear();
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
          this.log('Erro ao processar mensagem:', error);
        }
      }
    });

    this.log('✅ Message handler configurado');
  }

  private setupTypingHandler(): void {
    if (!this.sock) return;

    // Handler para eventos de presença (digitando)
    this.sock.ev.on('presence.update', async ({ id, presences }) => {
      try {
        if (!id) return;

        // Determinar se é grupo ou chat privado
        const isGroup = id.includes('@g.us');
        const chatId = id;

        // Processar cada presença
        for (const [participantId, presence] of Object.entries(presences)) {
          // Verificar se está digitando (composing ou recording)
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
        this.log('Erro ao processar indicador de digitação:', error);
      }
    });

    this.log('✅ Typing handler configurado');
  }

  /**
   * Método para extrair e logar todas as informações disponíveis do contato
   * NÃO normaliza automaticamente - apenas coleta dados para análise
   */
  private async identifyRealPhone(chatId: string, msg: WAMessage): Promise<string> {
    this.log(`📋 Analisando contato: ${chatId}`);

    // Extrair TODOS os dados disponíveis
    const contactData: any = {
      chatId,
      remoteJid: msg.key.remoteJid,
      pushName: msg.pushName || null,
      participant: msg.key.participant || null,
      fromMe: msg.key.fromMe,
    };

    // Verificar se é lid
    const isLid = chatId.includes('@lid');
    contactData.isLid = isLid;

    // Se for lid, tentar extrair número
    if (isLid) {
      const lidMatch = chatId.match(/^(\d+)@lid$/);
      if (lidMatch) {
        contactData.lidNumber = lidMatch[1];
      }
    }

    // Verificar pushName se parece número
    if (msg.pushName && /^\+?\d+$/.test(msg.pushName.replace(/\s/g, ''))) {
      contactData.pushNameAsNumber = msg.pushName.replace(/\D/g, '');
    }

    // Verificar contextInfo
    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
      contactData.contextParticipant = msg.message.extendedTextMessage.contextInfo.participant;
    }

    // Verificar vCard
    if (msg.message?.contactMessage?.vcard) {
      const vcard = msg.message.contactMessage.vcard;
      const phoneMatch = vcard.match(/TEL[^:]*:(\+?\d+)/);
      if (phoneMatch) {
        contactData.vcardPhone = phoneMatch[1].replace(/\D/g, '');
      }
    }

    // Verificar verifiedBizName
    if ((msg.message as any)?.verifiedBizName) {
      contactData.verifiedBizName = (msg.message as any).verifiedBizName;
    }

    // Tentar obter foto de perfil
    if (this.sock) {
      try {
        const profileUrl = await this.sock.profilePictureUrl(chatId, 'image');
        contactData.hasProfilePicture = !!profileUrl;
        contactData.profileUrl = profileUrl;
      } catch (error) {
        contactData.hasProfilePicture = false;
      }
    }

    // LOGAR TODOS OS DADOS COLETADOS
    this.log(`📊 DADOS DO CONTATO:`);
    this.log(`   chatId: ${contactData.chatId}`);
    this.log(`   remoteJid: ${contactData.remoteJid}`);
    this.log(`   pushName: ${contactData.pushName || 'N/A'}`);
    this.log(`   isLid: ${contactData.isLid}`);

    if (contactData.lidNumber) {
      this.log(`   lidNumber (extraído): ${contactData.lidNumber}`);
    }
    if (contactData.pushNameAsNumber) {
      this.log(`   pushName como número: ${contactData.pushNameAsNumber}`);
    }
    if (contactData.contextParticipant) {
      this.log(`   contextParticipant: ${contactData.contextParticipant}`);
    }
    if (contactData.vcardPhone) {
      this.log(`   vCard phone: ${contactData.vcardPhone}`);
    }
    if (contactData.verifiedBizName) {
      this.log(`   verifiedBizName: ${contactData.verifiedBizName}`);
    }
    this.log(`   hasProfilePicture: ${contactData.hasProfilePicture}`);

    // RETORNAR O chatId ORIGINAL SEM MODIFICAÇÃO
    this.log(`➡️ Usando chatId original: ${chatId}`);
    return chatId;
  }

  private async processMessage(msg: WAMessage): Promise<void> {
    // Ignorar mensagens próprias
    if (msg.key.fromMe) return;

    const chatId = msg.key.remoteJid!;
    const isGroup = isJidGroup(chatId);

    // Detectar tipo de mensagem e extrair informações
    let messageText = '';
    let hasMedia = false;
    let mediaType: 'audio' | 'image' | 'video' | 'document' | undefined;
    let mediaBuffer: Buffer | undefined;
    let mimetype: string | undefined;

    // Texto
    messageText =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      '';

    // Verificar áudio
    if (msg.message?.audioMessage) {
      this.log('🎤 Mensagem de áudio detectada!');
      hasMedia = true;
      mediaType = 'audio';
      mimetype = msg.message.audioMessage.mimetype || 'audio/ogg; codecs=opus';

      // NÃO baixar áudio aqui - deixar para o processador decidir se deve baixar
      // (apenas se houver agente atribuído)
      this.log('📋 Áudio marcado para download condicional');
    }

    // Verificar imagem
    if (msg.message?.imageMessage) {
      hasMedia = true;
      mediaType = 'image';
      mimetype = msg.message.imageMessage.mimetype || 'image/jpeg';
    }

    // Verificar vídeo
    if (msg.message?.videoMessage) {
      hasMedia = true;
      mediaType = 'video';
      mimetype = msg.message.videoMessage.mimetype || 'video/mp4';
    }

    // Verificar documento
    if (msg.message?.documentMessage) {
      hasMedia = true;
      mediaType = 'document';
      mimetype = msg.message.documentMessage.mimetype || 'application/octet-stream';
    }

    // Se não há texto nem mídia, ignorar
    if (!messageText && !hasMedia) {
      this.log('⚠️ Mensagem sem texto ou mídia, ignorando');
      return;
    }

    // Extrair o remetente real usando método robusto
    let from: string;

    if (isGroup) {
      // Em grupos, usar o participant (quem enviou a mensagem)
      from = msg.key.participant || chatId;
    } else {
      // Em conversas privadas, identificar o número real
      from = await this.identifyRealPhone(chatId, msg);
    }

    // Criar contexto da mensagem
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
      rawMessage: hasMedia ? msg : undefined, // Passar mensagem original para download condicional
    };

    // Adicionar informações de grupo se aplicável
    if (isGroup) {
      const groupInfo = this.groups.get(chatId);
      context.groupName = groupInfo?.name || 'Grupo';
      context.participant = msg.key.participant || undefined;

      this.log(`👥 Mensagem de grupo: ${context.groupName}`);
      this.log(`   De: ${context.participant || 'desconhecido'}`);
      if (hasMedia) {
        this.log(`   Tipo: ${mediaType} (${mimetype})`);
      }
      this.log(`   Texto: ${messageText.substring(0, 50)}...`);
    } else {
      this.log(`👤 Mensagem privada`);
      this.log(`   From: ${from}`);
      this.log(`   Chat ID: ${chatId}`);
      if (hasMedia) {
        this.log(`   Tipo: ${mediaType} (${mimetype})`);
      }
      this.log(`   Texto: ${messageText.substring(0, 50)}...`);

      // Atualizar/adicionar chat privado usando o from correto
      this.updatePrivateChat(from, messageText || '[Mídia]');
    }

    // Callback para processar
    if (this.messageCallback) {
      this.messageCallback(context);
    }
  }

  private updatePrivateChat(chatId: string, lastMessage: string): void {
    const existing = this.privateChats.get(chatId);

    this.privateChats.set(chatId, {
      id: chatId,
      phone: chatId.replace('@s.whatsapp.net', ''),
      name: existing?.name,
      isGroup: false,
      lastMessage,
      lastMessageTime: new Date(),
    });
  }

  private async loadGroupsAndChats(): Promise<void> {
    if (!this.sock) return;

    try {
      this.log('📋 Carregando grupos...');

      // Buscar grupos
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

      this.log(`✅ ${this.groups.size} grupos carregados`);
    } catch (error) {
      this.log('⚠️ Erro ao carregar grupos:', error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.log('🔌 Desconectando...');

      if (this.sock) {
        await this.sock.logout();
        this.sock = null;
      }

      this.handleDisconnected();
      this.log('✅ Desconectado com sucesso');
    } catch (error) {
      this.log('❌ Erro ao desconectar:', error);
      throw error;
    }
  }

  async clearAuth(): Promise<void> {
    try {
      this.log('━'.repeat(40));
      this.log('🗑️ LIMPEZA COMPLETA DE CREDENCIAIS');
      this.log('━'.repeat(40));

      // Desconectar primeiro
      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (error) {
          this.log('⚠️ Erro ao fazer logout:', error);
        }
        this.sock = null;
      }

      // Limpar pasta de autenticação
      const authPath = path.join(process.cwd(), 'auth_info_baileys');

      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        this.log('✅ Pasta de autenticação removida');
      }

      this.handleDisconnected();
      this.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO');
      this.log('━'.repeat(40));
    } catch (error) {
      this.log('❌ Erro ao limpar credenciais:', error);
      throw error;
    }
  }

  // ===== Typing Indicator =====
  async sendTyping(to: string, isTyping: boolean): Promise<void> {
    try {
      if (!this.sock || !this.isConnected) {
        return; // Silenciosamente falha se não conectado
      }

      // Determinar formato do ID
      let jid = to;

      if (!to.includes('@')) {
        // Se não tem @, assumir que é número de telefone
        const cleanPhone = to.replace(/\D/g, '');
        jid = `${cleanPhone}@s.whatsapp.net`;
      } else if (to.includes('@g.us')) {
        // Para grupos, usar o JID diretamente
        jid = to;
      } else if (to.includes('@s.whatsapp.net')) {
        jid = to;
      } else if (to.includes('@lid')) {
        // Lid não suporta presence update, pular
        this.log(`⚠️ Lid não suporta indicador de digitação: ${to}`);
        return;
      } else {
        // Tentar adicionar @s.whatsapp.net
        const cleanPhone = to.replace(/\D/g, '');
        jid = `${cleanPhone}@s.whatsapp.net`;
      }

      // Validar se o JID está no formato correto antes de enviar
      if (!jid.includes('@s.whatsapp.net') && !jid.includes('@g.us')) {
        this.log(`⚠️ JID inválido para indicador de digitação: ${jid}`);
        return;
      }

      // Enviar indicador de digitação
      // API correta do Baileys: sendPresenceUpdate(status, jid)
      // Status pode ser: 'composing', 'recording', 'paused', 'available', 'unavailable'
      await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);

      if (isTyping) {
        this.log(`⌨️ Indicador de digitação ativado para: ${to}`);
      } else {
        this.log(`⌨️ Indicador de digitação desativado para: ${to}`);
      }
    } catch (error) {
      // Não lançar erro - apenas logar
      const errorMsg = (error as Error).message;
      this.log(`⚠️ Erro ao enviar indicador de digitação: ${errorMsg}`);
    }
  }

  // ===== Message Sending =====
  async sendMessage(to: string, message: string | AnyMessageContent): Promise<void> {
    try {
      if (!this.sock || !this.isConnected) {
        throw new Error('WhatsApp não conectado');
      }

      this.log(`📤 Enviando mensagem para: ${to}`);

      // Determinar formato do ID
      let jid = to;

      if (to.includes('@g.us')) {
        // Já é um ID de grupo
        jid = to;
        this.log('👥 Enviando para grupo');
      } else if (to.includes('@s.whatsapp.net')) {
        // Já é um ID de contato
        jid = to;
        this.log('👤 Enviando para contato');
      } else {
        // É um número de telefone, converter para formato correto
        const cleanPhone = to.replace(/\D/g, '');
        jid = `${cleanPhone}@s.whatsapp.net`;
        this.log(`👤 Enviando para contato: ${cleanPhone}`);
      }

      // Enviar mensagem (suporta texto ou objeto de mídia)
      const content = typeof message === 'string' ? { text: message } : message;
      await this.sock.sendMessage(jid, content);

      this.log('✅ Mensagem enviada com sucesso');
    } catch (error: any) {
      this.log('❌ Erro ao enviar mensagem:', error.message);
      throw error;
    }
  }

  // ===== Callbacks =====
  onMessage(callback: (context: MessageContext) => void): void {
    this.messageCallback = callback;
    this.log('✅ Callback de mensagem registrado');
  }

  onStatusUpdate(callback: (status: WhatsAppConnection) => void): void {
    this.statusUpdateCallback = callback;
    this.notifyStatusUpdate();
    this.log('✅ Callback de status registrado');
  }

  onTyping(callback: (indicator: TypingIndicator) => void): void {
    this.typingCallback = callback;
    this.log('✅ Callback de digitação registrado');
  }

  // ===== Status =====
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

  // ===== Groups and Chats =====
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

    // Adicionar grupos
    for (const group of this.groups.values()) {
      contacts.push({
        id: group.id,
        phone: group.id,
        name: group.name,
        isGroup: true,
      });
    }

    // Adicionar chats privados
    for (const chat of this.privateChats.values()) {
      contacts.push({
        id: chat.id,
        phone: chat.phone,
        name: chat.name,
        isGroup: false,
      });
    }

    this.log(`📇 ${contacts.length} contatos (${this.groups.size} grupos + ${this.privateChats.size} privados)`);
    return contacts;
  }
}

export const whatsappManager = new WhatsAppManager();
