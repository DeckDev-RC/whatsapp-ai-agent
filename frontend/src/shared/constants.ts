// ============================================
// CONSTANTES COMPARTILHADAS
// ============================================

// ===== AI Models =====
export const AI_MODELS = {
  openai: [
    'gpt-4-turbo-preview',
    'gpt-4',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
  ],
  claude: [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-2.1',
  ],
  gemini: [
    // Modelos testados e funcionando (atualizado 24/11/2025)
    'gemini-2.0-flash',           // ✅ Modelo padrão recomendado (15 RPM, 1M TPM, 200 RPD) - TESTADO E FUNCIONANDO
    'gemini-2.0-flash-lite',      // ✅ Modelo lite mais rápido (30 RPM, 1M TPM, 200 RPD) - TESTADO E FUNCIONANDO
    'gemini-2.5-flash',           // ✅ Modelo 2.5 (10 RPM, 250K TPM, 250 RPD) - TESTADO E FUNCIONANDO
    'gemini-2.5-flash-lite',      // ✅ Modelo 2.5 lite (15 RPM, 250K TPM, 1K RPD) - TESTADO E FUNCIONANDO
    'gemini-2.5-flash-native-audio-dialog', // 🎧 Modelo nativo de áudio (Experimental)
    // Modelos legados (podem não estar disponíveis para todas as chaves)
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-pro',
    'gemini-pro-vision',
    // Modelo experimental (quota excedida - não recomendado)
    // 'gemini-2.0-flash-exp',    // ❌ Removido - quota excedida
  ],
  openrouter: [
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'openai/gpt-4-turbo-preview',
    'google/gemini-pro',
    'meta-llama/llama-3-70b-instruct',
  ],
} as const;

// ===== IPC Channels =====
export const IPC_CHANNELS = {
  // WhatsApp
  WHATSAPP_GET_STATUS: 'whatsapp:get-status',
  WHATSAPP_GENERATE_QR: 'whatsapp:generate-qr',
  WHATSAPP_DISCONNECT: 'whatsapp:disconnect',
  WHATSAPP_CLEAR_AUTH: 'whatsapp:clear-auth',
  WHATSAPP_ON_MESSAGE: 'whatsapp:on-message',
  WHATSAPP_SEND_MESSAGE: 'whatsapp:send-message',
  WHATSAPP_STATUS_UPDATE: 'whatsapp:status-update',
  WHATSAPP_ON_TYPING: 'whatsapp:on-typing',
  WHATSAPP_GET_CONTACTS: 'whatsapp:get-contacts',
  WHATSAPP_SYNC_CONTACTS: 'whatsapp:sync-contacts',
  WHATSAPP_GET_GROUPS: 'whatsapp:get-groups',
  WHATSAPP_GET_CHATS: 'whatsapp:get-chats',


  // Supabase
  SUPABASE_TEST_CONNECTION: 'supabase:test-connection',
  SUPABASE_SAVE_CONFIG: 'supabase:save-config',
  SUPABASE_GET_CONFIG: 'supabase:get-config',

  // Tenants
  TENANT_GET_ALL: 'tenant:get-all',
  TENANT_CREATE: 'tenant:create',
  TENANT_UPDATE: 'tenant:update',
  TENANT_DELETE: 'tenant:delete',

  // WhatsApp Numbers
  WHATSAPP_NUMBER_GET_ALL: 'whatsapp-number:get-all',
  WHATSAPP_NUMBER_CREATE: 'whatsapp-number:create',
  WHATSAPP_NUMBER_UPDATE: 'whatsapp-number:update',
  WHATSAPP_NUMBER_DELETE: 'whatsapp-number:delete',

  // AI Config
  AI_SAVE_CONFIG: 'ai:save-config',
  AI_GET_CONFIG: 'ai:get-config',
  AI_TEST_CONNECTION: 'ai:test-connection',
  AI_SET_ACTIVE: 'ai:set-active',
  AI_AUTO_CONFIGURE: 'ai:auto-configure',
  AI_SET_MANUAL_CONFIG: 'ai:set-manual-config',
  AI_SET_KEYPOOL_CONFIG: 'ai:set-keypool-config',

  // API Keys Management
  API_KEY_ADD: 'api-key:add',
  API_KEY_ADD_MULTIPLE: 'api-key:add-multiple',
  API_KEY_REMOVE: 'api-key:remove',
  API_KEY_UPDATE: 'api-key:update',
  API_KEY_TOGGLE_ACTIVE: 'api-key:toggle-active',
  API_KEY_GET_ALL: 'api-key:get-all',
  API_KEY_GET_BY_PROVIDER: 'api-key:get-by-provider',
  API_KEY_GET_STATS: 'api-key:get-stats',
  API_KEY_CLEAR_DUPLICATES: 'api-key:clear-duplicates',
  API_KEY_RESET_ALL: 'api-key:reset-all',

  // Agents Management
  AGENT_CREATE: 'agent:create',
  AGENT_UPDATE: 'agent:update',
  AGENT_DELETE: 'agent:delete',
  AGENT_TOGGLE_ACTIVE: 'agent:toggle-active',
  AGENT_GET: 'agent:get',
  AGENT_GET_ALL: 'agent:get-all',
  AGENT_GET_ACTIVE: 'agent:get-active',
  AGENT_GET_BY_PROVIDER: 'agent:get-by-provider',
  AGENT_GET_STATS: 'agent:get-stats',

  // Agent Assignments
  AGENT_ASSIGN_TO_CONTACT: 'agent:assign-to-contact',
  AGENT_REMOVE_ASSIGNMENT: 'agent:remove-assignment',
  AGENT_REMOVE_ASSIGNMENT_BY_CONTACT: 'agent:remove-assignment-by-contact',
  AGENT_GET_ASSIGNMENT_BY_CONTACT: 'agent:get-assignment-by-contact',
  AGENT_GET_ASSIGNMENTS_BY_AGENT: 'agent:get-assignments-by-agent',
  AGENT_GET_ALL_ASSIGNMENTS: 'agent:get-all-assignments',
  AGENT_GET_FOR_CONTACT: 'agent:get-for-contact',

  // Orders
  ORDER_GET_BY_TENANT: 'order:get-by-tenant',
  ORDER_SEARCH: 'order:search',

  // Conversations
  CONVERSATION_GET_ALL: 'conversation:get-all',
  CONVERSATION_GET_BY_TENANT: 'conversation:get-by-tenant',

  // Stats
  STATS_GET: 'stats:get',

  // Window Controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // System Prompt
  SYSTEM_PROMPT_GET: 'system-prompt:get',

  // Metrics / Observability
  METRICS_GET_ENDPOINT_STATS: 'metrics:get-endpoint-stats',
  METRICS_GET_PROVIDER_STATS: 'metrics:get-provider-stats',
  METRICS_GET_USER_STATS: 'metrics:get-user-stats',
  METRICS_GET_RECENT_ALERTS: 'metrics:get-recent-alerts',
  METRICS_GET_CURRENT_QUOTAS: 'metrics:get-current-quotas',
  METRICS_GET_QUEUE_STATS: 'metrics:get-queue-stats',
  METRICS_GET_CACHE_STATS: 'metrics:get-cache-stats',

  // RAG Monitoring
  RAG_GET_STATS: 'rag:get-stats',
  RAG_TEST_SEARCH: 'rag:test-search',
  RAG_CLEAR_CACHE: 'rag:clear-cache',

  // RAG/Embedding Operations
  RAG_INITIALIZE: 'rag:initialize',
  RAG_INDEX_ORDER: 'rag:index-order',
  RAG_INDEX_ORDERS_BATCH: 'rag:index-orders-batch',
  RAG_VECTOR_SEARCH: 'rag:vector-search',
  RAG_HYBRID_SEARCH: 'rag:hybrid-search',
  RAG_GET_EMBEDDING_STATS: 'rag:get-embedding-stats',
} as const;

// ===== Default Values =====
export const DEFAULT_AI_CONFIG = {
  temperature: 0.7,
  maxTokens: 2000,
  isActive: false,
};

export const SYSTEM_PROMPT_TEMPLATE = `
Você é um assistente virtual da empresa {COMPANY_NAME}.

Você tem acesso aos seguintes dados desta empresa:

PEDIDOS RECENTES:
{ORDERS_DATA}

REGRAS:
- Responda APENAS sobre informações desta empresa
- Seja profissional, prestativo e objetivo
- Se não souber a resposta, seja honesto
- Não invente informações
- Use uma linguagem clara e amigável

Responda à seguinte mensagem do cliente:
`.trim();

