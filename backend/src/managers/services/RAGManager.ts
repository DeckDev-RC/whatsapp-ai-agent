// ============================================
// RAG MANAGER - Retrieval-Augmented Generation
// ============================================

import OpenAI from 'openai';
import { cacheManager } from './CacheManager';
import type { Order, AIProvider, AIConfig } from '../../shared/types';
import type { DatabaseManager } from '../database/DatabaseManager';
import { configStore } from '../../config/ConfigStore';

interface OrderEmbedding {
  order: Order;
  embedding: number[];
  text: string; // Texto usado para gerar embedding
}

/**
 * Sistema RAG para buscar orders relevantes usando busca vetorial
 * Primeiro recupera docs relevantes via índice vetorial; só chama LLM se necessário
 */
export class RAGManager {
  private orderEmbeddings: Map<string, OrderEmbedding> = new Map(); // order_id -> embedding
  private embeddingsInitialized: Set<string> = new Set(); // tenant_id -> initialized

  /**
   * Gera embedding para um texto usando a API do provider
   */
  private async generateEmbedding(text: string, provider: string, apiKey: string): Promise<number[]> {
    // Verificar cache primeiro
    const cached = cacheManager.getCachedEmbedding(text);
    if (cached) {
      return cached;
    }

    try {
      let embedding: number[];

      // OpenAI tem API de embeddings dedicada
      if (provider === 'openai') {
        const client = new OpenAI({ apiKey });

        const response = await client.embeddings.create({
          model: 'text-embedding-3-small', // Modelo mais barato e rápido
          input: text,
        });

        embedding = response.data[0].embedding;
      } else if (provider === 'gemini') {
        // Gemini usa API REST para embeddings
        // Modelo: text-embedding-004 (mais recente) ou text-embedding-004 (padrão)
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: {
                  parts: [{ text: text }],
                },
              }),
            }
          );

          if (!response.ok) {
            const errorData: any = await response.json().catch(() => ({}));
            throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
          }

          const data: any = await response.json();
          embedding = data.embedding.values;

          console.log(`[RAGManager] ✅ Embedding gerado com Gemini (${embedding.length} dimensões)`);
        } catch (error) {
          console.warn(`[RAGManager] Erro ao gerar embedding com Gemini, tentando modelo alternativo:`, error);

          // Fallback: tentar com textembedding-gecko@003 (modelo mais antigo mas mais estável)
          try {
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/textembedding-gecko@003:embedContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'models/textembedding-gecko@003',
                  content: {
                    parts: [{ text: text }],
                  },
                }),
              }
            );

            if (response.ok) {
              const data: any = await response.json();
              embedding = data.embedding.values;
              console.log(`[RAGManager] ✅ Embedding gerado com Gemini (gecko@003, ${embedding.length} dimensões)`);
            } else {
              throw new Error(`Fallback também falhou: ${response.statusText}`);
            }
          } catch (fallbackError) {
            console.warn(`[RAGManager] Ambos os modelos Gemini falharam, usando fallback simples:`, fallbackError);
            embedding = this.simpleHashEmbedding(text);
          }
        }
      } else {
        // Para outros providers (Claude, OpenRouter), usar fallback
        // Nota: Claude não tem API de embeddings pública
        // OpenRouter pode ter, mas requer configuração específica
        console.warn(`[RAGManager] Provider ${provider} não tem API de embeddings dedicada, usando fallback`);

        // Fallback: gerar embedding simples baseado em hash (não ideal, mas funcional)
        embedding = this.simpleHashEmbedding(text);
      }

      // Armazenar em cache
      cacheManager.setCachedEmbedding(text, embedding);

      return embedding;
    } catch (error) {
      console.error('[RAGManager] Erro ao gerar embedding:', error);
      // Fallback para embedding simples
      return this.simpleHashEmbedding(text);
    }
  }

  /**
   * Embedding simples baseado em hash (fallback quando não há API de embeddings)
   * Não é ideal, mas permite funcionar sem OpenAI
   */
  private simpleHashEmbedding(text: string): number[] {
    // Gerar vetor de 384 dimensões (tamanho padrão de muitos embeddings)
    const embedding = new Array(384).fill(0);
    const normalized = text.toLowerCase().trim();

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const index = charCode % 384;
      embedding[index] += 1 / (i + 1); // Peso decrescente
    }

    // Normalizar
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Cria texto representativo de um order para embedding
   */
  private orderToText(order: Order): string {
    const parts: string[] = [];

    parts.push(`Pedido ${order.external_order_id}`);
    parts.push(`Status: ${order.status}`);
    parts.push(`Marketplace: ${order.marketplace}`);
    parts.push(`Valor: R$ ${order.total_amount}`);

    if (order.created_at) {
      const date = new Date(order.created_at);
      parts.push(`Data: ${date.toLocaleDateString('pt-BR')}`);
    }

    return parts.join('. ');
  }

  /**
   * Calcula similaridade de cosseno entre dois vetores
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.warn('[RAGManager] Vetores de tamanhos diferentes, usando tamanho mínimo');
      const minLen = Math.min(a.length, b.length);
      a = a.slice(0, minLen);
      b = b.slice(0, minLen);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Obtém provider ativo e configuração
   */
  private getActiveProviderConfig(): { provider: AIProvider | null; config: AIConfig | null } {
    const aiConfigs = configStore.get('ai') as Record<string, AIConfig> | null;
    if (!aiConfigs) {
      return { provider: null, config: null };
    }

    for (const [provider, config] of Object.entries(aiConfigs)) {
      if (config?.isActive) {
        const apiKey = configStore.getSecureKey(provider as AIProvider);
        return {
          provider: provider as AIProvider,
          config: { ...config, apiKey: apiKey || '' },
        };
      }
    }

    return { provider: null, config: null };
  }

  /**
   * Inicializa embeddings para orders de um tenant
   */
  async initializeEmbeddingsForTenant(
    tenantId: string,
    databaseManager: DatabaseManager
  ): Promise<void> {
    if (this.embeddingsInitialized.has(tenantId)) {
      console.log(`[RAGManager] Embeddings já inicializados para tenant ${tenantId}`);
      return;
    }

    try {
      console.log(`[RAGManager] Inicializando embeddings para tenant ${tenantId}...`);

      // Buscar todos os orders do tenant
      const orders = await databaseManager.getOrdersByTenant(tenantId);
      console.log(`[RAGManager] Encontrados ${orders.length} orders para processar`);

      // Obter provider e API key para gerar embeddings
      const { provider: activeProvider, config } = this.getActiveProviderConfig();
      if (!activeProvider) {
        console.warn('[RAGManager] Nenhum provider ativo, usando embeddings simples');
      }

      // Gerar embeddings para cada order
      let processed = 0;
      for (const order of orders) {
        const text = this.orderToText(order);

        // Se tiver provider ativo, tentar gerar embedding real
        let embedding: number[];
        if (activeProvider && config?.apiKey) {
          try {
            embedding = await this.generateEmbedding(text, activeProvider, config.apiKey);
          } catch (error) {
            console.warn(`[RAGManager] Erro ao gerar embedding para order ${order.id}, usando fallback:`, error);
            embedding = this.simpleHashEmbedding(text);
          }
        } else {
          embedding = this.simpleHashEmbedding(text);
        }

        this.orderEmbeddings.set(order.id, {
          order,
          embedding,
          text,
        });

        processed++;
        if (processed % 10 === 0) {
          console.log(`[RAGManager] Processados ${processed}/${orders.length} orders`);
        }
      }

      this.embeddingsInitialized.add(tenantId);
      console.log(`[RAGManager] ✅ Embeddings inicializados para ${processed} orders`);
    } catch (error) {
      console.error(`[RAGManager] Erro ao inicializar embeddings:`, error);
      throw error;
    }
  }

  /**
   * Busca orders relevantes usando busca vetorial
   */
  async searchRelevantOrders(
    query: string,
    tenantId: string,
    topK: number = 5
  ): Promise<Array<{ order: Order; score: number }>> {
    // Gerar embedding da query
    const { provider: activeProvider, config } = this.getActiveProviderConfig();
    let queryEmbedding: number[];

    if (activeProvider && config?.apiKey) {
      try {
        queryEmbedding = await this.generateEmbedding(query, activeProvider, config.apiKey);
      } catch (error) {
        console.warn('[RAGManager] Erro ao gerar embedding da query, usando fallback:', error);
        queryEmbedding = this.simpleHashEmbedding(query);
      }
    } else {
      queryEmbedding = this.simpleHashEmbedding(query);
    }

    // Buscar orders do tenant
    const tenantOrders = Array.from(this.orderEmbeddings.values())
      .filter(oe => oe.order.tenant_id === tenantId);

    if (tenantOrders.length === 0) {
      console.log(`[RAGManager] Nenhum order encontrado para tenant ${tenantId}`);
      return [];
    }

    // Calcular similaridade para cada order
    const scoredOrders = tenantOrders.map(oe => ({
      order: oe.order,
      score: this.cosineSimilarity(queryEmbedding, oe.embedding),
    }));

    // Ordenar por score (maior primeiro) e retornar top-K
    const topOrders = scoredOrders
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(item => item.score > 0.1); // Filtrar scores muito baixos

    console.log(`[RAGManager] Encontrados ${topOrders.length} orders relevantes para query: "${query}"`);

    return topOrders;
  }

  /**
   * Adiciona ou atualiza embedding de um order
   */
  async updateOrderEmbedding(order: Order): Promise<void> {
    const text = this.orderToText(order);

    const { provider: activeProvider, config } = this.getActiveProviderConfig();
    let embedding: number[];

    if (activeProvider && config?.apiKey) {
      try {
        embedding = await this.generateEmbedding(text, activeProvider, config.apiKey);
      } catch (error) {
        console.warn(`[RAGManager] Erro ao gerar embedding, usando fallback:`, error);
        embedding = this.simpleHashEmbedding(text);
      }
    } else {
      embedding = this.simpleHashEmbedding(text);
    }

    this.orderEmbeddings.set(order.id, {
      order,
      embedding,
      text,
    });
  }

  /**
   * Remove embedding de um order
   */
  removeOrderEmbedding(orderId: string): void {
    this.orderEmbeddings.delete(orderId);
  }

  /**
   * Limpa embeddings de um tenant
   */
  clearTenantEmbeddings(tenantId: string): void {
    const toRemove: string[] = [];
    this.orderEmbeddings.forEach((oe, orderId) => {
      if (oe.order.tenant_id === tenantId) {
        toRemove.push(orderId);
      }
    });

    toRemove.forEach(id => this.orderEmbeddings.delete(id));
    this.embeddingsInitialized.delete(tenantId);

    console.log(`[RAGManager] Removidos ${toRemove.length} embeddings do tenant ${tenantId}`);
  }

  /**
   * Obtém estatísticas do RAG
   */
  getStats() {
    return {
      totalEmbeddings: this.orderEmbeddings.size,
      initializedTenants: Array.from(this.embeddingsInitialized),
    };
  }
}

export const ragManager = new RAGManager();

