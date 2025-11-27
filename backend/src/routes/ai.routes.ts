import { Router, Request, Response } from 'express';
import type { AIManager } from '../managers/ai/AIManager';
import type { AIProvider, AIConfig } from '../shared/types';

export function aiRoutes(aiManager: AIManager) {
    const router = Router();

    // Save AI config
    router.post('/config/:provider', async (req: Request, res: Response) => {
        try {
            const provider = req.params.provider as AIProvider;
            const config: AIConfig = req.body;
            await aiManager.saveConfig(provider, config);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get AI config
    router.get('/config', async (req: Request, res: Response) => {
        try {
            const config = aiManager.getConfig();
            res.json({ success: true, data: config });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Test connection
    router.post('/test-connection/:provider', async (req: Request, res: Response) => {
        try {
            const provider = req.params.provider as AIProvider;
            const config: AIConfig = req.body;
            const isConnected = await aiManager.testConnection(provider, config);
            res.json({ success: true, data: isConnected });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Set active provider
    router.post('/set-active/:provider', async (req: Request, res: Response) => {
        try {
            const provider = req.params.provider as AIProvider;
            await aiManager.setActiveProvider(provider);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Auto-configure
    router.post('/auto-configure', async (req: Request, res: Response) => {
        try {
            const result = await aiManager.autoConfigureFromAvailableKeys();
            res.json({ success: result.success, data: result.provider, error: result.message });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
}
