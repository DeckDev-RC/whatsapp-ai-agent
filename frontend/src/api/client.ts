// API Client for HTTP requests
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

class APIClient {
    private baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<APIResponse<T>> {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const data = await response.json();
            return data;
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Network error'
            };
        }
    }

    async get<T>(endpoint: string): Promise<APIResponse<T>> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    async post<T>(endpoint: string, body?: any): Promise<APIResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined
        });
    }

    async put<T>(endpoint: string, body?: any): Promise<APIResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined
        });
    }

    async delete<T>(endpoint: string): Promise<APIResponse<T>> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }
}

export const apiClient = new APIClient(API_BASE_URL);

// API methods organized by domain
export const api = {
    // WhatsApp
    whatsapp: {
        getStatus: () => apiClient.get('/whatsapp/status'),
        connect: () => apiClient.post('/whatsapp/connect'),
        disconnect: () => apiClient.post('/whatsapp/disconnect'),
        clearAuth: () => apiClient.post('/whatsapp/clear-auth'),
        sendMessage: (to: string, message: string) =>
            apiClient.post('/whatsapp/send-message', { to, message }),
        getContacts: () => apiClient.get('/whatsapp/contacts')
    },

    // Database
    database: {
        testConnection: (config: any) => apiClient.post('/database/test-connection', config),
        saveConfig: (config: any) => apiClient.post('/database/save-config', config),
        getConfig: () => apiClient.get('/database/config'),
        getConversations: (limit?: number) =>
            apiClient.get(`/database/conversations${limit ? `?limit=${limit}` : ''}`),
        getConversationsByTenant: (tenantId: string) =>
            apiClient.get(`/database/conversations/${tenantId}`)
    },

    // AI
    ai: {
        saveConfig: (provider: string, config: any) =>
            apiClient.post(`/ai/config/${provider}`, config),
        getConfig: () => apiClient.get('/ai/config'),
        testConnection: (provider: string, config: any) =>
            apiClient.post(`/ai/test-connection/${provider}`, config),
        setActive: (provider: string) => apiClient.post(`/ai/set-active/${provider}`),
        autoConfigure: () => apiClient.post('/ai/auto-configure')
    },

    // Tenants
    tenants: {
        getAll: () => apiClient.get('/tenants'),
        create: (tenant: any) => apiClient.post('/tenants', tenant),
        update: (id: string, tenant: any) => apiClient.put(`/tenants/${id}`, tenant),
        delete: (id: string) => apiClient.delete(`/tenants/${id}`),
        getOrders: (tenantId: string, limit?: number) =>
            apiClient.get(`/tenants/${tenantId}/orders${limit ? `?limit=${limit}` : ''}`),
        searchOrders: (query: string) => apiClient.get(`/tenants/orders/search?q=${query}`)
    },

    // WhatsApp Numbers
    whatsappNumbers: {
        getAll: () => apiClient.get('/tenants/whatsapp-numbers'),
        create: (number: any) => apiClient.post('/tenants/whatsapp-numbers', number),
        update: (id: string, number: any) =>
            apiClient.put(`/tenants/whatsapp-numbers/${id}`, number),
        delete: (id: string) => apiClient.delete(`/tenants/whatsapp-numbers/${id}`)
    },

    // Agents
    agents: {
        getAll: () => apiClient.get('/agents'),
        get: (id: string) => apiClient.get(`/agents/${id}`),
        create: (data: any) => apiClient.post('/agents', data),
        update: (id: string, updates: any) => apiClient.put(`/agents/${id}`, updates),
        delete: (id: string) => apiClient.delete(`/agents/${id}`),
        toggleActive: (id: string) => apiClient.post(`/agents/${id}/toggle-active`),
        getActive: () => apiClient.get('/agents/active/list'),
        getByProvider: (provider: string) => apiClient.get(`/agents/provider/${provider}`),
        getStats: () => apiClient.get('/agents/stats/all'),

        // Assignments
        getAllAssignments: () => apiClient.get('/agents/assignments/all'),
        assignToContact: (agentId: string, contactPhone: string, contactName?: string) =>
            apiClient.post('/agents/assignments', { agentId, contactPhone, contactName }),
        removeAssignment: (id: string) => apiClient.delete(`/agents/assignments/${id}`),
        getAssignmentByContact: (phone: string) =>
            apiClient.get(`/agents/assignments/contact/${phone}`),
        getAgentForContact: (phone: string) => apiClient.get(`/agents/for-contact/${phone}`)
    },

    // RAG
    rag: {
        getStats: () => apiClient.get('/rag/stats'),
        testSearch: (query: string, tenantId: string, topK?: number) =>
            apiClient.post('/rag/test-search', { query, tenantId, topK }),
        clearCache: (tenantId: string) => apiClient.post(`/rag/clear-cache/${tenantId}`),
        initialize: (apiKey: string) => apiClient.post('/rag/initialize', { apiKey }),
        indexOrder: (order: any) => apiClient.post('/rag/index-order', order),
        indexBatch: (tenantId: string, limit?: number) =>
            apiClient.post('/rag/index-batch', { tenantId, limit }),
        vectorSearch: (query: string, tenantId: string, limit?: number, threshold?: number) =>
            apiClient.post('/rag/vector-search', { query, tenantId, limit, threshold }),
        getEmbeddingStats: (tenantId: string) =>
            apiClient.get(`/rag/embedding-stats/${tenantId}`)
    },

    // Metrics
    metrics: {
        getEndpointStats: (endpoint: string, timeWindow?: number) =>
            apiClient.get(`/metrics/endpoint/${endpoint}${timeWindow ? `?timeWindow=${timeWindow}` : ''}`),
        getProviderStats: (provider: string, timeWindow?: number) =>
            apiClient.get(`/metrics/provider/${provider}${timeWindow ? `?timeWindow=${timeWindow}` : ''}`),
        getUserStats: (userId: string, timeWindow?: number) =>
            apiClient.get(`/metrics/user/${userId}${timeWindow ? `?timeWindow=${timeWindow}` : ''}`),
        getAlerts: (limit?: number) =>
            apiClient.get(`/metrics/alerts${limit ? `?limit=${limit}` : ''}`),
        getQuotas: () => apiClient.get('/metrics/quotas'),
        getQueueStats: (provider?: string) =>
            apiClient.get(`/metrics/queue${provider ? `?provider=${provider}` : ''}`),
        getCacheStats: () => apiClient.get('/metrics/cache'),
        getAPIKeyStats: () => apiClient.get('/metrics/api-keys'),
        getAllAPIKeys: () => apiClient.get('/metrics/api-keys/all'),
        addAPIKey: (provider: string, key: string, label?: string) =>
            apiClient.post('/metrics/api-keys', { provider, key, label }),
        removeAPIKey: (id: string) => apiClient.delete(`/metrics/api-keys/${id}`),
        toggleAPIKey: (id: string) => apiClient.post(`/metrics/api-keys/${id}/toggle`)
    }
};

// Aliases for backward compatibility with Electron API structure
(api as any).supabase = api.database;
(api as any).agent = api.agents;
(api as any).stats = {
    get: () => apiClient.get('/metrics/global')
};

// API Key alias
(api as any).apiKey = {
    getAll: () => apiClient.get('/metrics/api-keys/all'),
    getStats: () => apiClient.get('/metrics/api-keys'),
    add: (provider: string, key: string, label?: string) => api.metrics.addAPIKey(provider, key, label),
    remove: (id: string) => api.metrics.removeAPIKey(id),
    toggle: (id: string) => api.metrics.toggleAPIKey(id)
};

// Logs alias
(api as any).logs = {
    getAll: () => apiClient.get('/metrics/logs')
};

// System Prompt alias
(api as any).systemPrompt = {
    get: () => apiClient.get('/ai/system-prompt'),
    save: (prompt: string) => apiClient.post('/ai/system-prompt', { prompt })
};

// WhatsApp syncContacts and generateQR
(api.whatsapp as any).syncContacts = () => apiClient.post('/whatsapp/sync-contacts');
(api.whatsapp as any).generateQR = () => apiClient.post('/whatsapp/connect');

// Metrics getRecentAlerts alias
(api.metrics as any).getRecentAlerts = (limit?: number) => api.metrics.getAlerts(limit);

// RAG alias
(api as any).rag = {
    getStats: () => apiClient.get('/rag/stats'),
    testSearch: (query: string, tenantId: string, limit?: number) => apiClient.post('/rag/test-search', { query, tenantId, topK: limit }),
    clearCache: (tenantId: string) => apiClient.post(`/rag/clear-cache/${tenantId}`)
};
