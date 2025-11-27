export interface IPCResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface SupabaseConfig {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
}

export type AIProvider = 'openai' | 'claude' | 'gemini' | 'openrouter';

export interface AIConfig {
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    configMode?: 'manual' | 'keypool';
    useKeyRotation?: boolean;
}

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
}

export interface MessageContext {
    from: string;
    chatId: string;
    isGroup: boolean;
    message: string;
    groupName?: string;
    participant?: string;
    messageType?: 'text' | 'audio' | 'image' | 'video' | 'document';
    audioBuffer?: Buffer;
    mediaUrl?: string;
}

export interface Order {
    id: string;
    external_order_id: string;
    tenant_id: string;
    status: string;
    total_amount: number;
    customer_name?: string;
    customer_phone?: string;
    items?: any[];
    created_at: string;
}

export interface Conversation {
    id: string;
    tenant_id: string;
    phone_number: string;
    message: string;
    role: 'user' | 'assistant';
    created_at: string;
}

export interface WhatsAppStatus {
    isConnected: boolean;
    qrCode?: string;
    phoneNumber?: string;
}

export interface Agent {
    id: string;
    name: string;
    provider: AIProvider;
    model: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    isActive: boolean;
    created_at: string;
    updated_at?: string;
}

export interface AgentAssignment {
    id: string;
    agent_id: string;
    contact_phone: string;
    contact_name?: string;
    created_at: string;
}

export interface APIKey {
    id: string;
    provider: AIProvider;
    key: string;
    label?: string;
    isActive: boolean;
    usage_count: number;
    last_used?: string;
    created_at: string;
}
