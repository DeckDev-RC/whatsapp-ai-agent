import { create } from 'zustand';
import type { Agent, AIConfig, AIProvider, Tenant, WhatsAppNumber, Conversation, WhatsAppConnection, AgentAssignment, APIKey, APIKeyStats, AgentStats } from '../shared/types';

// ============================================
// APP STORE - Estado Global da Aplicação
// ============================================

interface AppState {
  // WhatsApp
  whatsapp: WhatsAppConnection | null;
  whatsappLoading: boolean;
  whatsappContacts: any[];
  contactsLoading: boolean;

  // Supabase
  whatsapp: WhatsAppConnection | null;
  supabaseLoading: boolean;

  // AI
  aiConfigs: Record<AIProvider, AIConfig> | null;
  activeAIProvider: AIProvider | null;
  aiLoading: boolean;

  // API Keys
  apiKeys: APIKey[];
  apiKeyStats: APIKeyStats | null;
  apiKeysLoading: boolean;

  // Agents
  agents: Agent[];
  agentStats: AgentStats | null;
  agentsLoading: boolean;

  // Agent Assignments
  agentAssignments: AgentAssignment[];
  assignmentsLoading: boolean;

  // Stats
  statsLoading: boolean;

  // Actions
  updateWhatsApp: (connection: WhatsAppConnection | null) => void;
  updateWhatsAppContacts: (contacts: any[]) => void;
  updateAIConfigs: (configs: Record<AIProvider, AIConfig>) => void;
  setActiveAIProvider: (provider: AIProvider | null) => void;
  updateAPIKeys: (keys: APIKey[], stats: APIKeyStats | null) => void;
  updateAgents: (agents: Agent[], stats: AgentStats | null) => void;
  updateAgentAssignments: (assignments: AgentAssignment[]) => void;

  // Loaders
  loadWhatsAppStatus: () => Promise<void>;
  loadWhatsAppContacts: () => Promise<void>;
  syncWhatsAppContacts: () => Promise<{ synced: number; errors: number }>;
  loadSupabaseConfig: () => Promise<void>;
  loadAIConfigs: () => Promise<void>;
  loadAPIKeys: () => Promise<void>;
  loadAgents: () => Promise<void>;
  loadAgentAssignments: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadAll: () => Promise<void>;
}

// ============================================
// APP STORE
// ============================================

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  whatsapp: null,
  whatsappLoading: false,
  whatsappContacts: [],
  contactsLoading: false,
  supabase: null,
  supabaseLoading: false,
  aiConfigs: null,
  activeAIProvider: null,
  aiLoading: false,
  apiKeys: [],
  apiKeyStats: null,
  apiKeysLoading: false,
  agents: [],
  agentStats: null,
  agentsLoading: false,
  agentAssignments: [],
  assignmentsLoading: false,
  stats: null,
  statsLoading: false,

  // Actions
  updateWhatsApp: (connection) => {
    set({ whatsapp: connection });
  },

  updateWhatsAppContacts: (contacts) => {
    set({ whatsappContacts: contacts });
  },

  updateSupabase: (config) => {
    set({ supabase: config });
  },

  updateAIConfigs: (configs) => {
    // Encontrar provider ativo
    let activeProvider: AIProvider | null = null;
    for (const [provider, config] of Object.entries(configs)) {
      if (config?.isActive) {
        activeProvider = provider as AIProvider;
        break;
      }
    }

    set({
      aiConfigs: configs,
      activeAIProvider: activeProvider
    });
  },

  setActiveAIProvider: (provider) => {
    set({ activeAIProvider: provider });
  },

  updateAPIKeys: (keys, stats) => {
    set({ apiKeys: keys, apiKeyStats: stats });
  },

  updateAgents: (agents, stats) => {
    set({ agents, agentStats: stats });
  },

  updateAgentAssignments: (assignments) => {
    set({ agentAssignments: assignments });
  },

  updateStats: (stats) => {
    set({ stats });
  },

  // Loaders
  loadWhatsAppStatus: async () => {
    const currentState = get();
    if (currentState.whatsappLoading) {
      return;
    }

    set({ whatsappLoading: true });
    try {
      const response = await window.api.whatsapp.getStatus();
      if (response.success && response.data) {
        set({ whatsapp: response.data });
      }
    } catch (error) {
      console.error('[AppStore] Erro ao carregar status WhatsApp:', error);
    } finally {
      set({ whatsappLoading: false });
    }
  },

  loadSupabaseConfig: async () => {
    const currentState = get();
    if (currentState.supabaseLoading) {
      return;
    }

    set({ supabaseLoading: true });
    try {
      const response = await window.api.supabase.getConfig();
      if (response.success && response.data) {
        set({ supabase: response.data });
      }
    } catch (error) {
      console.error('[AppStore] Erro ao carregar config Supabase:', error);
    } finally {
      set({ supabaseLoading: false });
    }
  },

  loadAIConfigs: async () => {
    // Evita múltiplas chamadas simultâneas
    const currentState = get();
    if (currentState.aiLoading) {
      return;
    }

    set({ aiLoading: true });
    try {
      const response = await window.api.ai.getConfig();

      if (response.success && response.data) {
        const configs = response.data as Record<AIProvider, AIConfig>;

        // Encontrar provider ativo
        let activeProvider: AIProvider | null = null;
        for (const [provider, config] of Object.entries(configs)) {
          if (config?.isActive) {
            activeProvider = provider as AIProvider;
            break;
          }
        }

        set({
          aiConfigs: configs,
          activeAIProvider: activeProvider
        });
      }
    } catch (error) {
      console.error('[AppStore] Erro ao carregar configs de IA:', error);
    } finally {
      set({ aiLoading: false });
    }
  },

  loadStats: async () => {
    const currentState = get();
    if (currentState.statsLoading) {
      return;
    }

    set({ statsLoading: true });
    try {
      const response = await window.api.stats.get();
      if (response.success && response.data) {
        set({ stats: response.data });
      }
    } catch (error) {
      console.error('[AppStore] Erro ao carregar estatísticas:', error);
    } finally {
      set({ statsLoading: false });
    }
  },

  loadAPIKeys: async () => {
    const currentState = get();
    if (currentState.apiKeysLoading) {
      return;
    }

    set({ apiKeysLoading: true });
    try {
      const [keysRes, statsRes] = await Promise.all([
        window.api.apiKey.getAll(),
        window.api.apiKey.getStats(),
      ]);

      const keys = keysRes.success && keysRes.data ? keysRes.data : [];
      const stats = statsRes.success && statsRes.data ? statsRes.data : null;

      set({ apiKeys: keys, apiKeyStats: stats });
    } catch (error) {
      console.error('[AppStore] Erro ao carregar API keys:', error);
    } finally {
      set({ apiKeysLoading: false });
    }
  },

  loadAgents: async () => {
    const currentState = get();
    if (currentState.agentsLoading) {
      return;
    }

    set({ agentsLoading: true });
    try {
      const [agentsRes, statsRes] = await Promise.all([
        window.api.agent.getAll(),
        window.api.agent.getStats(),
      ]);

      const agents = agentsRes.success && agentsRes.data ? agentsRes.data : [];
      const stats = statsRes.success && statsRes.data ? statsRes.data : null;

      set({ agents, agentStats: stats });
    } catch (error) {
      console.error('[AppStore] Erro ao carregar agentes:', error);
    } finally {
      set({ agentsLoading: false });
    }
  },

  loadAgentAssignments: async () => {
    const currentState = get();
    if (currentState.assignmentsLoading) {
      return;
    }

    set({ assignmentsLoading: true });
    try {
      const response = await window.api.agent.getAllAssignments();

      if (response.success && response.data) {
        set({ agentAssignments: response.data });
      }
    } catch (error) {
      console.error('[AppStore] Erro ao carregar atribuições:', error);
    } finally {
      set({ assignmentsLoading: false });
    }
  },

  loadWhatsAppContacts: async () => {
    const currentState = get();
    if (currentState.contactsLoading) {
      return;
    }

    // Só carrega se WhatsApp estiver conectado
    if (!currentState.whatsapp?.isConnected) {
      set({ whatsappContacts: [] });
      return;
    }

    set({ contactsLoading: true });
    try {
      // Buscar contatos diretamente do WhatsApp (sem sincronizar com banco)
      const response = await window.api.whatsapp.getContacts();

      if (response.success && response.data) {
        set({ whatsappContacts: response.data });
        console.log(`[AppStore] ${response.data.length} contatos carregados do WhatsApp (modo local)`);
      }
    } catch (error) {
      console.error('[AppStore] Erro ao carregar contatos WhatsApp:', error);
    } finally {
      set({ contactsLoading: false });
    }
  },

  syncWhatsAppContacts: async () => {
    set({ contactsLoading: true });
    try {
      const response = await window.api.whatsapp.syncContacts();

      if (response.success && response.data) {
        set({ whatsappContacts: response.data.contacts });
        console.log(`[AppStore] Sincronizados ${response.data.syncResult.synced} contatos`);
        return response.data.syncResult;
      }

      return { synced: 0, errors: 0 };
    } catch (error) {
      console.error('[AppStore] Erro ao sincronizar contatos WhatsApp:', error);
      return { synced: 0, errors: 1 };
    } finally {
      set({ contactsLoading: false });
    }
  },

  loadAll: async () => {
    // Evita múltiplas chamadas simultâneas de loadAll
    const currentState = get();
    if (currentState.whatsappLoading || currentState.aiLoading ||
      currentState.supabaseLoading || currentState.statsLoading ||
      currentState.apiKeysLoading || currentState.agentsLoading ||
      currentState.assignmentsLoading || currentState.contactsLoading) {
      return; // Já há um carregamento em andamento
    }

    await Promise.all([
      get().loadWhatsAppStatus(),
      get().loadWhatsAppContacts(),
      get().loadSupabaseConfig(),
      get().loadAIConfigs(),
      get().loadAPIKeys(),
      get().loadAgents(),
      get().loadAgentAssignments(),
      get().loadStats(),
    ]);
  },
}));

// ============================================
// Auto-refresh hook - Otimizado
// ============================================

let refreshInterval: NodeJS.Timeout | null = null;
let isRefreshing = false;

export function startAutoRefresh(intervalMs: number = 10000) { // Aumentado para 10 segundos
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  // Carrega imediatamente (apenas uma vez)
  if (!isRefreshing) {
    isRefreshing = true;
    useAppStore.getState().loadAll().finally(() => {
      isRefreshing = false;
    });
  }

  // Depois atualiza periodicamente com debounce
  refreshInterval = setInterval(() => {
    if (!isRefreshing) {
      isRefreshing = true;
      useAppStore.getState().loadAll().finally(() => {
        isRefreshing = false;
      });
    }
  }, intervalMs);
}

export function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    isRefreshing = false;
  }
}

// Força um refresh imediato (útil após salvar configs)
export function forceRefresh() {
  if (!isRefreshing) {
    isRefreshing = true;
    useAppStore.getState().loadAll().finally(() => {
      isRefreshing = false;
    });
  }
}

