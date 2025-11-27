import { Router, Request, Response } from 'express';
import { ragManager } from '../managers/services/RAGManager';
import { embeddingManager } from '../managers/services/EmbeddingManager';
import { databaseManager } from '../managers/database/DatabaseManager';

export function ragRoutes() {
    const router = Router();

    // Get RAG stats
    router.get('/stats', async (req: Request, res: Response) => {
        try {
            const stats = ragManager.getStats();
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Test search
    router.post('/test-search', async (req: Request, res: Response) => {
        try {
            const { query, tenantId, topK } = req.body;
            const results = await ragManager.searchRelevantOrders(query, tenantId, topK || 5);
            res.json({ success: true, data: results });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Clear cache
    router.post('/clear-cache/:tenantId', async (req: Request, res: Response) => {
        try {
            const { tenantId } = req.params;
            ragManager.clearTenantEmbeddings(tenantId);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Initialize embedding manager
    router.post('/initialize', async (req: Request, res: Response) => {
        try {
            const { apiKey } = req.body;
            await embeddingManager.initialize(apiKey);
            res.json({ success: true, data: { message: 'EmbeddingManager inicializado com sucesso' } });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Index single order
    router.post('/index-order', async (req: Request, res: Response) => {
        try {
            const order = req.body;
            await embeddingManager.indexOrder(order);
            res.json({ success: true, data: { message: `Pedido ${order.external_order_id} indexado` } });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Index orders batch
    router.post('/index-batch', async (req: Request, res: Response) => {
        try {
            const { tenantId, limit } = req.body;

            // Fetch orders
            const orders = await databaseManager.getOrdersByTenant(tenantId, limit);

            // Index in batch
            const result = await embeddingManager.indexOrdersBatch(orders);

            res.json({
                success: true,
                data: {
                    message: `Indexação concluída: ${result.success} sucesso, ${result.failed} falhas`,
                    success: result.success,
                    failed: result.failed,
                    total: orders.length
                }
            });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Vector search
    router.post('/vector-search', async (req: Request, res: Response) => {
        try {
            const { query, tenantId, limit, threshold } = req.body;
            const results = await embeddingManager.vectorSearch(
                query,
                { tenantId },
                limit || 10,
                threshold || 0.7
            );
            res.json({ success: true, data: results });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get embedding stats
    router.get('/embedding-stats/:tenantId', async (req: Request, res: Response) => {
        try {
            const { tenantId } = req.params;
            const stats = await embeddingManager.getStats(tenantId);
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
}
