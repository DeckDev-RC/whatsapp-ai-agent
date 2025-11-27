// ============================================
// TIPOS COMPARTILHADOS - Electron + Renderer
// ============================================

// ===== Database Types =====
export interface Tenant {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

export interface WhatsAppNumber {
  id: string;
  tenant_id: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  phone_number: string;
  message: string;
  role: 'user' | 'assistant';
  created_at: string;
}

// Tipo antigo (mantido para compatibilidade)
export interface MLOrder {
  id: string;
  status: string;
  date_created: string;
  date_last_updated: string;
  total_amount: number;
  currency_id: string;
  buyer_nickname: string;
  buyer_email?: string;
  seller_nickname: string;
  item_title?: string;
  item_quantity?: number;
  payment_status_principal?: string;
  shipping_status?: string;
  raw_data: Record<string, unknown>;
}

// Tipo atualizado para a estrutura real da tabela orders
export interface Order {
  id: string;
  tenant_id: string;
  marketplace: string;
  external_order_id: string;
  status: string;
  total_amount: string; // String no banco, pode ser convertido para number
  created_at: string;
  updated_at?: string;
}

// ===== AI Provider Types =====
export type AIProvider = 'openai' | 'claude' | 'gemini' | 'openrouter';

export type AIConfigMode = 'manual' | 'keypool';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string; // Usado apenas no modo manual
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  configMode?: AIConfigMode; // Modo de configuração
  useKeyRotation?: boolean; // Se deve usar rotação de chaves
  audioConfig?: {
    enabled: boolean;
    voiceName?: string; // Para futuro uso
    responseModalities?: ('text' | 'audio')[]; // text, audio, or both
  };
}

export interface AudioResponse {
  audioBuffer: Buffer;
  mimeType: string;
  duration?: number;
}

export interface AIProviderConfig {
  openai?: AIConfig;
  claude?: AIConfig;
  gemini?: AIConfig;
  openrouter?: AIConfig;
}

// ===== WhatsApp Types =====
export interface WhatsAppConnection {
  isConnected: boolean;
  qrCode?: string;
  phoneNumber?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'qr';
  statusMessage?: string;
}

export interface WhatsAppMessage {
  from: string;
  message: string;
  timestamp: Date;
}

export interface WhatsAppContact {
  id: string;
  phone: string;
  name?: string;
  pushName?: string;
  isGroup: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  profilePicUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

// ===== Group and Chat Types =====
export interface GroupInfo {
  id: string;
  name: string;
  participants: number;
  description?: string;
  createdAt: Date;
  lastMessageTime?: Date;
}

export interface ChatInfo {
  id: string;
  phone: string;
  name?: string;
  isGroup: boolean;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
}

export interface MessageContext {
  from: string;           // Número/ID do remetente
  chatId: string;         // ID do chat (grupo ou privado)
  isGroup: boolean;       // Se é grupo
  groupName?: string;     // Nome do grupo (se aplicável)
  message: string;        // Texto da mensagem
  timestamp: Date;        // Timestamp
  participant?: string;   // Participante que enviou (em grupos)
  messageId?: string;     // ID da mensagem
  hasMedia?: boolean;     // Se a mensagem contém mídia
  mediaType?: 'audio' | 'image' | 'video' | 'document'; // Tipo de mídia
  mediaUrl?: string;      // URL da mídia (se disponível)
  mediaBuffer?: Buffer;   // Buffer da mídia (para processamento)
  mimetype?: string;      // MIME type da mídia
  rawMessage?: any;       // Mensagem original do WhatsApp (para download condicional)
}


export interface TypingIndicator {
  chatId: string;         // ID do chat (grupo ou privado)
  from: string;           // Número/ID de quem está digitando
  isTyping: boolean;       // true = digitando, false = parou de digitar
  participant?: string;    // Participante que está digitando (em grupos)
  timestamp: Date;         // Timestamp do evento
}


// ===== Function Calling Types =====
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface DatabaseQueryFilters {
  status?: string;
  tenantId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  active?: boolean;
  category?: string;
  isGroup?: boolean;
}

// ===== Supabase Config =====
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  isConnected: boolean;
}

// ===== API Key Types =====
export interface APIKey {
  id: string;
  provider: AIProvider;
  key: string;
  label: string;
  isActive: boolean;
  requestCount: number;
  errorCount: number;
  consecutiveErrors: number;
  lastUsed?: Date;
  lastErrorTime?: Date;
  healthScore: number;
  priority: number;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface APIKeyStats {
  totalKeys: number;
  activeKeys: number;
  totalRequests: number;
  totalErrors: number;
  averageHealthScore: number;
  keysByProvider: Record<string, number>;
}

// ===== Agent Types =====
export interface Agent {
  id: string;
  name: string;
  description?: string;
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentAssignment {
  id: string;
  agentId: string;
  contactId: string; // WhatsApp contact/conversation ID
  contactName?: string;
  contactPhone: string;
  createdAt: string;
}

export interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  totalAssignments: number;
  agentsByProvider: Record<string, number>;
}

// ===== IPC Messages =====
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===== Stats =====
export interface Stats {
  messagesCount: number;
  activeTenants: number;
  activeModel?: string;
  whatsappConnected: boolean;
  databaseConnected: boolean;
}

