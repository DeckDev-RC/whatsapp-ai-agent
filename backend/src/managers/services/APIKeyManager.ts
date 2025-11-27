import { configStore } from '../../config/ConfigStore';
import type { AIProvider, APIKey } from '../../shared/types';

// ============================================
// API KEY MANAGER - Gerenciamento de Chaves
// ============================================

class APIKeyManager {
  private keys: Map<string, APIKey> = new Map();
  private lastUsedIndex: Map<AIProvider, number> = new Map();
  private requestHistory: Map<string, number[]> = new Map();

  constructor() {
    this.loadKeys();
  }

  private loadKeys() {
    // Carregar chaves do configStore
    const stored = configStore.get('api_keys') as unknown as APIKey[] || [];
    if (Array.isArray(stored)) {
      stored.forEach(key => {
        this.keys.set(key.id, key);
      });
    }
    console.log(`[APIKeyManager] ${this.keys.size} API Keys carregadas`);
  }

  private saveKeys() {
    const keysArray = Array.from(this.keys.values());
    configStore.set('api_keys', keysArray as unknown[]);
  }

  async addKey(provider: AIProvider, key: string, label?: string): Promise<APIKey> {
    const newKey: APIKey = {
      id: `${provider}_${Date.now()}`,
      provider,
      key,
      label: label || `${provider} Key`,
      isActive: true,
      requestCount: 0,
      errorCount: 0,
      consecutiveErrors: 0,
      healthScore: 100,
      priority: 1,
    };

    this.keys.set(newKey.id, newKey);
    this.saveKeys();
    return newKey;
  }

  async addMultipleKeys(provider: AIProvider, keys: Array<{ key: string; label?: string }>): Promise<APIKey[]> {
    const addedKeys: APIKey[] = [];
    for (const keyData of keys) {
      const newKey = await this.addKey(provider, keyData.key, keyData.label);
      addedKeys.push(newKey);
    }
    return addedKeys;
  }

  async removeKey(keyId: string): Promise<void> {
    this.keys.delete(keyId);
    this.saveKeys();
  }

  async updateKey(keyId: string, updates: Partial<APIKey>): Promise<void> {
    const key = this.keys.get(keyId);
    if (key) {
      Object.assign(key, updates);
      this.saveKeys();
    }
  }

  async toggleKeyActive(keyId: string): Promise<void> {
    const key = this.keys.get(keyId);
    if (key) {
      key.isActive = !key.isActive;
      this.saveKeys();
    }
  }

  getAllKeys(): APIKey[] {
    return Array.from(this.keys.values());
  }

  getKeysByProvider(provider: AIProvider): APIKey[] {
    return Array.from(this.keys.values()).filter(
      key => key.provider === provider && key.isActive
    );
  }

  async getNextKey(provider: AIProvider): Promise<APIKey | null> {
    const providerKeys = this.getKeysByProvider(provider);
    if (providerKeys.length === 0) return null;

    const lastIndex = this.lastUsedIndex.get(provider) || 0;
    const nextIndex = (lastIndex + 1) % providerKeys.length;
    this.lastUsedIndex.set(provider, nextIndex);

    return providerKeys[nextIndex];
  }

  /**
   * Obtém limites de rate por provider/modelo
   */
  private getRateLimits(provider: AIProvider, model?: string): { rpm: number; tpm: number } {
    // Limites conservadores baseados em quotas conhecidas
    const limits: Record<AIProvider, { rpm: number; tpm: number }> = {
      gemini: {
        rpm: 12, // Abaixo de 15 RPM para gemini-2.0-flash
        tpm: 800000, // Abaixo de 1M TPM
      },
      openai: {
        rpm: 50, // Limite típico
        tpm: 400000,
      },
      claude: {
        rpm: 40,
        tpm: 800000,
      },
      openrouter: {
        rpm: 30,
        tpm: 400000,
      },
    };

    // Ajustes específicos por modelo Gemini
    if (provider === 'gemini' && model) {
      if (model.includes('2.5-flash')) {
        return { rpm: 8, tpm: 200000 }; // 10 RPM, 250K TPM
      }
      if (model.includes('2.0-flash-lite')) {
        return { rpm: 25, tpm: 800000 }; // 30 RPM
      }
      if (model.includes('2.5-flash-lite')) {
        return { rpm: 12, tpm: 200000 }; // 15 RPM, 250K TPM
      }
    }

    return limits[provider] || { rpm: 30, tpm: 100000 };
  }

  canMakeRequest(keyId: string, provider?: AIProvider, model?: string): boolean {
    const key = this.keys.get(keyId);
    if (!key) return false;

    const providerToUse = provider || key.provider;
    const limits = this.getRateLimits(providerToUse, model);

    const history = this.requestHistory.get(keyId) || [];
    const now = Date.now();
    const recentRequests = history.filter(time => now - time < 60000); // Últimos 60s

    // Verificar RPM (requests per minute)
    return recentRequests.length < limits.rpm;
  }

  getNextRequestDelay(keyId: string, provider?: AIProvider, model?: string): number {
    const key = this.keys.get(keyId);
    if (!key) return 0;

    const providerToUse = provider || key.provider;
    const limits = this.getRateLimits(providerToUse, model);

    const history = this.requestHistory.get(keyId) || [];
    if (history.length === 0) return 0;

    const now = Date.now();
    const recentRequests = history.filter(time => now - time < 60000);

    if (recentRequests.length >= limits.rpm) {
      const oldestRequest = Math.min(...recentRequests);
      const timeSinceOldest = now - oldestRequest;
      return Math.max(0, 60000 - timeSinceOldest);
    }

    return 0;
  }

  async recordRequest(keyId: string, success: boolean, _responseTime?: number): Promise<void> {
    const key = this.keys.get(keyId);
    if (!key) return;

    // Atualizar estatísticas
    key.requestCount++;
    key.lastUsed = new Date();

    if (success) {
      key.consecutiveErrors = 0;
      key.healthScore = Math.min(100, key.healthScore + 1);
    } else {
      key.errorCount++;
      key.consecutiveErrors++;
      key.lastErrorTime = new Date();
      key.healthScore = Math.max(0, key.healthScore - 10);
    }

    // Registrar no histórico
    const history = this.requestHistory.get(keyId) || [];
    history.push(Date.now());
    // Manter apenas últimos 100 registros
    if (history.length > 100) {
      history.shift();
    }
    this.requestHistory.set(keyId, history);

    this.saveKeys();
  }

  getAggregatedStats() {
    const stats = {
      totalKeys: this.keys.size,
      activeKeys: 0,
      totalRequests: 0,
      totalErrors: 0,
      averageHealthScore: 0,
      keysByProvider: {} as Record<string, number>,
    };

    let totalHealth = 0;
    this.keys.forEach(key => {
      if (key.isActive) stats.activeKeys++;
      stats.totalRequests += key.requestCount;
      stats.totalErrors += key.errorCount;
      totalHealth += key.healthScore;
      stats.keysByProvider[key.provider] = (stats.keysByProvider[key.provider] || 0) + 1;
    });

    stats.averageHealthScore = this.keys.size > 0 ? totalHealth / this.keys.size : 0;

    return stats;
  }

  async clearDuplicateKeys(): Promise<{ removed: number }> {
    const seen = new Set<string>();
    const toRemove: string[] = [];

    this.keys.forEach((key, id) => {
      const signature = `${key.provider}:${key.key}`;
      if (seen.has(signature)) {
        toRemove.push(id);
      } else {
        seen.add(signature);
      }
    });

    toRemove.forEach(id => this.keys.delete(id));
    this.saveKeys();

    return { removed: toRemove.length };
  }

  async resetAllKeys(): Promise<void> {
    this.keys.clear();
    this.lastUsedIndex.clear();
    this.requestHistory.clear();
    this.saveKeys();
  }
}

export const apiKeyManager = new APIKeyManager();
