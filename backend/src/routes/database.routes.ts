import { Router, Request, Response } from 'express';
import type { DatabaseManager } from '../managers/database/DatabaseManager';

export function databaseRoutes(databaseManager: DatabaseManager) {
    const router = Router();

    // Test connection
    router.post('/test-connection', async (req: Request, res: Response) => {
        try {
            const config = req.body;
            const isConnected = await databaseManager.testConnection(config);
            res.json({ success: true, data: isConnected });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Save config
    router.post('/save-config', async (req: Request, res: Response) => {
        try {
            const config = req.body;
            await databaseManager.saveConfig(config);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get config
    router.get('/config', async (req: Request, res: Response) => {
        try {
            const config = databaseManager.getConfig();
            res.json({ success: true, data: config });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get all conversations
    router.get('/conversations', async (req: Request, res: Response) => {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
            const conversations = await databaseManager.getAllConversations(limit);
            res.json({ success: true, data: conversations });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get conversations by tenant
    router.get('/conversations/:tenantId', async (req: Request, res: Response) => {
        try {
            const { tenantId } = req.params;
            const conversations = await databaseManager.getConversationsByTenant(tenantId);
            res.json({ success: true, data: conversations });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
}
