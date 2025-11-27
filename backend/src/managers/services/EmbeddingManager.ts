// ============================================
// EMBEDDING MANAGER - RAG System Core
// ============================================
// Gerencia embeddings para busca semântica (RAG)
// Baseado em best practices 2024-2025

import OpenAI from 'openai';
import { databaseManager } from '../database/DatabaseManager';

// ===== Types =====

export interface EmbeddingDocument {
    id?: string;
    tenantId: string;
    documentType: 'order' | 'customer' | 'product' | 'conversation';
    documentId: string;
    content: string;
    metadata: Record<string, any>;
    embedding?: number[];
    createdAt?: Date;
}

export interface SearchResult {
    document: EmbeddingDocument;
    similarity: number;
}

export interface SearchFilters {
    tenantId: string;
    documentType?: string;
    dateRange?: { start: Date; end: Date };
    metadata?: Record<string, any>;
}

// ===== Embedding Manager =====

export class EmbeddingManager {
    private openai: OpenAI | null = null;
    private embeddingModel = 'text-embedding-3-small'; // 1536 dims, $0.02/1M tokens

    constructor() {
        console.log('[EmbeddingManager] Inicializado');
    }

    /**
     * Inicializa o cliente OpenAI com API key
     */
    async initialize(apiKey: string): Promise<void> {
        this.openai = new OpenAI({ apiKey });
        console.log('[EmbeddingManager] ✅ Cliente OpenAI inicializado');
    }

    /**
     * Gera embedding para um texto
     */
    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.openai) {
            throw new Error('EmbeddingManager não inicializado. Chame initialize() primeiro.');
        }

        try {
            console.log(`[EmbeddingManager] 🔄 Gerando embedding para texto de ${text.length} caracteres...`);

            const response = await this.openai.embeddings.create({
                model: this.embeddingModel,
                input: text,
                encoding_format: 'float',
            });

            const embedding = response.data[0].embedding;
            console.log(`[EmbeddingManager] ✅ Embedding gerado: ${embedding.length} dimensões`);

            return embedding;
        } catch (error) {
            console.error('[EmbeddingManager] ❌ Erro ao gerar embedding:', error);
            throw error;
        }
    }

    /**
     * Gera embeddings em batch (mais eficiente)
     */
    async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
        if (!this.openai) {
            throw new Error('EmbeddingManager não inicializado');
        }

        try {
            console.log(`[EmbeddingManager] 🔄 Gerando ${texts.length} embeddings em batch...`);

            const response = await this.openai.embeddings.create({
                model: this.embeddingModel,
                input: texts,
                encoding_format: 'float',
            });

            const embeddings = response.data.map(d => d.embedding);
            console.log(`[EmbeddingManager] ✅ ${embeddings.length} embeddings gerados`);

            return embeddings;
        } catch (error) {
            console.error('[EmbeddingManager] ❌ Erro ao gerar embeddings em batch:', error);
            throw error;
        }
    }

    /**
     * Cria documento rico a partir de um pedido
     */
    createOrderDocument(order: any): string {
        const parts = [
            `Pedido #${order.external_order_id || order.id}`,
            `Cliente: ${order.customer_name || 'N/A'}`,
            `Status: ${order.status || 'N/A'}`,
            `Valor: R$ ${order.total_amount || '0.00'}`,
            `Data: ${order.order_date || 'N/A'}`,
            `Marketplace: ${order.marketplace || 'N/A'}`,
        ];

        // Adicionar produtos se disponível
        if (order.items && order.items.length > 0) {
            const products = order.items.map((item: any) =>
                `${item.name} (${item.quantity}x)`
            ).join(', ');
            parts.push(`Produtos: ${products}`);
        }

        // Adicionar endereço se disponível
        if (order.shipping_address) {
            parts.push(`Endereço: ${order.shipping_address}`);
        }

        return parts.join('\n');
    }

    /**
     * Indexa um pedido no banco de dados vetorial
     */
    async indexOrder(order: any): Promise<void> {
        try {
            console.log(`[EmbeddingManager] 📝 Indexando pedido ${order.external_order_id}...`);

            // Criar documento rico
            const content = this.createOrderDocument(order);

            // Gerar embedding
            const embedding = await this.generateEmbedding(content);

            // Preparar metadata
            const metadata = {
                status: order.status,
                amount: parseFloat(order.total_amount || '0'),
                date: order.order_date,
                marketplace: order.marketplace,
                customer_name: order.customer_name,
            };

            // Salvar no banco
            const { error } = await databaseManager.getClient()
                .from('document_embeddings')
                .insert({
                    tenant_id: order.tenant_id,
                    document_type: 'order',
                    document_id: order.id,
                    content,
                    metadata,
                    embedding,
                });

            if (error) {
                throw error;
            }

            console.log(`[EmbeddingManager] ✅ Pedido ${order.external_order_id} indexado com sucesso`);
        } catch (error) {
            console.error(`[EmbeddingManager] ❌ Erro ao indexar pedido ${order.external_order_id}:`, error);
            throw error;
        }
    }

    /**
     * Indexa múltiplos pedidos em batch
     */
    async indexOrdersBatch(orders: any[]): Promise<{ success: number; failed: number }> {
        console.log(`[EmbeddingManager] 🔄 Indexando ${orders.length} pedidos em batch...`);

        let success = 0;
        let failed = 0;

        // Processar em chunks de 100 para evitar sobrecarga
        const chunkSize = 100;
        for (let i = 0; i < orders.length; i += chunkSize) {
            const chunk = orders.slice(i, i + chunkSize);

            try {
                // Gerar documentos
                const contents = chunk.map(order => this.createOrderDocument(order));

                // Gerar embeddings em batch
                const embeddings = await this.generateEmbeddingsBatch(contents);

                // Preparar dados para inserção
                const documents = chunk.map((order, idx) => ({
                    tenant_id: order.tenant_id,
                    document_type: 'order',
                    document_id: order.id,
                    content: contents[idx],
                    metadata: {
                        status: order.status,
                        amount: parseFloat(order.total_amount || '0'),
                        date: order.order_date,
                        marketplace: order.marketplace,
                        customer_name: order.customer_name,
                    },
                    embedding: embeddings[idx],
                }));

                // Inserir em batch
                const { error } = await databaseManager.getClient()
                    .from('document_embeddings')
                    .insert(documents);

                if (error) {
                    console.error(`[EmbeddingManager] ❌ Erro ao inserir chunk ${i}-${i + chunkSize}:`, error);
                    failed += chunk.length;
                } else {
                    success += chunk.length;
                    console.log(`[EmbeddingManager] ✅ Chunk ${i}-${i + chunkSize} indexado (${success}/${orders.length})`);
                }
            } catch (error) {
                console.error(`[EmbeddingManager] ❌ Erro ao processar chunk ${i}-${i + chunkSize}:`, error);
                failed += chunk.length;
            }
        }

        console.log(`[EmbeddingManager] 🎯 Indexação concluída: ${success} sucesso, ${failed} falhas`);
        return { success, failed };
    }

    /**
     * Busca vetorial simples (cosine similarity)
     */
    async vectorSearch(
        query: string,
        filters: SearchFilters,
        limit: number = 10,
        threshold: number = 0.7
    ): Promise<SearchResult[]> {
        try {
            console.log(`[EmbeddingManager] 🔍 Buscando: "${query.substring(0, 50)}..."`);

            // Gerar embedding da query
            const queryEmbedding = await this.generateEmbedding(query);

            // Buscar documentos similares usando função SQL
            const { data, error } = await databaseManager.getClient()
                .rpc('match_documents', {
                    query_embedding: queryEmbedding,
                    match_threshold: threshold,
                    match_count: limit,
                    filter_tenant: filters.tenantId,
                    filter_type: filters.documentType || null,
                });

            if (error) {
                throw error;
            }

            console.log(`[EmbeddingManager] ✅ Encontrados ${data?.length || 0} documentos`);

            return (data || []).map((item: any) => ({
                document: {
                    id: item.id,
                    tenantId: item.tenant_id,
                    documentType: item.document_type,
                    documentId: item.document_id,
                    content: item.content,
                    metadata: item.metadata,
                    createdAt: item.created_at,
                },
                similarity: item.similarity,
            }));
        } catch (error) {
            console.error('[EmbeddingManager] ❌ Erro na busca vetorial:', error);
            throw error;
        }
    }

    /**
     * Obtém estatísticas de embeddings
     */
    async getStats(tenantId: string): Promise<{
        total: number;
        byType: Record<string, number>;
    }> {
        try {
            const { data, error } = await databaseManager.getClient()
                .from('document_embeddings')
                .select('document_type')
                .eq('tenant_id', tenantId);

            if (error) {
                throw error;
            }

            const byType: Record<string, number> = {};
            data?.forEach((item: any) => {
                byType[item.document_type] = (byType[item.document_type] || 0) + 1;
            });

            return {
                total: data?.length || 0,
                byType,
            };
        } catch (error) {
            console.error('[EmbeddingManager] ❌ Erro ao obter estatísticas:', error);
            return { total: 0, byType: {} };
        }
    }
}

// Singleton instance
export const embeddingManager = new EmbeddingManager();
