// ============================================
// CACHE MANAGER - Cache de Respostas e Embeddings
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live em ms
}

/**
 * Sistema de cache em memória para respostas de IA e embeddings
 * Reduz chamadas idênticas/semelhantes à API
 */
export class CacheManager {
  private responseCache: Map<string, CacheEntry<string>> = new Map();
  private embeddingCache: Map<string, CacheEntry<number[]>> = new Map();

  // Configurações padrão
  private defaultResponseTTL = 3600000; // 1 hora
  private defaultEmbeddingTTL = 86400000; // 24 horas (embeddings mudam raramente)

  // Limites de cache
  private maxResponseCacheSize = 1000;
  private maxEmbeddingCacheSize = 5000;

  /**
   * Gera chave de cache baseada no prompt e configurações
   */
  private generateCacheKey(
    prompt: string,
    provider: string,
    model: string,
    temperature?: number
  ): string {
    // Normalizar prompt (lowercase, remover espaços extras)
    const normalizedPrompt = prompt.toLowerCase().trim().replace(/\s+/g, ' ');

    // Criar hash simples (em produção, usar crypto.createHash)
    const hash = this.simpleHash(`${provider}:${model}:${temperature || 0.7}:${normalizedPrompt}`);
    return hash;
  }

  /**
   * Hash simples para cache key (em produção, usar crypto)
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Busca resposta em cache
   */
  getCachedResponse(
    prompt: string,
    provider: string,
    model: string,
    temperature?: number
  ): string | null {
    const key = this.generateCacheKey(prompt, provider, model, temperature);
    const entry = this.responseCache.get(key);

    if (!entry) {
      return null;
    }

    // Verificar se expirou
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.responseCache.delete(key);
      return null;
    }

    console.log(`[CacheManager] ✅ Cache hit para resposta (${key.substring(0, 8)}...)`);
    return entry.data;
  }

  /**
   * Armazena resposta em cache
   */
  setCachedResponse(
    prompt: string,
    provider: string,
    model: string,
    response: string,
    ttl?: number
  ): void {
    const key = this.generateCacheKey(prompt, provider, model);

    // Limpar cache se estiver muito grande
    if (this.responseCache.size >= this.maxResponseCacheSize) {
      this.evictOldestEntries(this.responseCache, this.maxResponseCacheSize * 0.8);
    }

    this.responseCache.set(key, {
      data: response,
      timestamp: Date.now(),
      ttl: ttl || this.defaultResponseTTL,
    });

    console.log(`[CacheManager] 💾 Resposta armazenada em cache (${key.substring(0, 8)}...)`);
  }

  /**
   * Busca embedding em cache
   */
  getCachedEmbedding(text: string): number[] | null {
    const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');
    const key = this.simpleHash(normalizedText);
    const entry = this.embeddingCache.get(key);

    if (!entry) {
      return null;
    }

    // Verificar se expirou
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.embeddingCache.delete(key);
      return null;
    }

    console.log(`[CacheManager] ✅ Cache hit para embedding (${key.substring(0, 8)}...)`);
    return entry.data;
  }

  /**
   * Armazena embedding em cache
   */
  setCachedEmbedding(text: string, embedding: number[], ttl?: number): void {
    const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');
    const key = this.simpleHash(normalizedText);

    // Limpar cache se estiver muito grande
    if (this.embeddingCache.size >= this.maxEmbeddingCacheSize) {
      this.evictOldestEntries(this.embeddingCache, this.maxEmbeddingCacheSize * 0.8);
    }

    this.embeddingCache.set(key, {
      data: embedding,
      timestamp: Date.now(),
      ttl: ttl || this.defaultEmbeddingTTL,
    });

    console.log(`[CacheManager] 💾 Embedding armazenado em cache (${key.substring(0, 8)}...)`);
  }

  /**
   * Remove entradas mais antigas do cache
   */
  private evictOldestEntries<T>(cache: Map<string, CacheEntry<T>>, targetSize: number): void {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp); // Ordenar por timestamp

    const toRemove = entries.slice(0, entries.length - targetSize);
    toRemove.forEach(([key]) => cache.delete(key));

    console.log(`[CacheManager] 🗑️ Removidas ${toRemove.length} entradas antigas do cache`);
  }

  /**
   * Limpa cache expirado
   */
  cleanExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    // Limpar respostas expiradas
    for (const [key, entry] of this.responseCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.responseCache.delete(key);
        cleaned++;
      }
    }

    // Limpar embeddings expirados
    for (const [key, entry] of this.embeddingCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.embeddingCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[CacheManager] 🧹 Limpeza: ${cleaned} entradas expiradas removidas`);
    }
  }

  /**
   * Limpa todo o cache
   */
  clearAll(): void {
    this.responseCache.clear();
    this.embeddingCache.clear();
    console.log('[CacheManager] 🗑️ Cache completamente limpo');
  }

  /**
   * Estatísticas do cache
   */
  getStats() {
    return {
      responseCacheSize: this.responseCache.size,
      embeddingCacheSize: this.embeddingCache.size,
      responseCacheHits: 0, // TODO: adicionar contador de hits
      embeddingCacheHits: 0, // TODO: adicionar contador de hits
    };
  }
}

export const cacheManager = new CacheManager();

// Limpar cache expirado a cada 5 minutos
setInterval(() => {
  cacheManager.cleanExpiredEntries();
}, 5 * 60 * 1000);


