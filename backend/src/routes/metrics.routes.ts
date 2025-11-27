import { Router, Request, Response } from 'express';
import { observabilityManager } from '../managers/services/ObservabilityManager';
import { queueManager } from '../managers/services/QueueManager';
import { cacheManager } from '../managers/services/CacheManager';
import { apiKeyManager } from '../managers/services/APIKeyManager';
import { whatsappManager } from '../managers/whatsapp/WhatsAppManager';
import { databaseManager } from '../managers/database/DatabaseManager';
import { aiManager } from '../managers/ai/AIManager';
import type { AIProvider } from '../types';

export function metricsRoutes() {
    const router = Router();

    // Get global stats
    router.get('/global', async (req: Request, res: Response) => {
        try {
            // Mock implementation for now if managers don't expose exact counts
            // In a real implementation, we would add getCount() methods to managers
            const activeTenants = 1; // Default to 1 for now
            const messagesCount = 0; // Needs implementation in WhatsAppManager

            const stats = {
                messagesCount,
                activeTenants,
                activeModel: aiManager.getActiveProvider(),
                whatsappConnected: whatsappManager.getStatus().isConnected,
                databaseConnected: databaseManager.isConnected()
            };
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get endpoint stats
    router.get('/endpoint/:endpoint', async (req: Request, res: Response) => {
        try {
            const { endpoint } = req.params;
            const timeWindow = req.query.timeWindow ? parseInt(req.query.timeWindow as string) : undefined;
            const stats = observabilityManager.getEndpointStats(endpoint, timeWindow);
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get provider stats
    router.get('/provider/:provider', async (req: Request, res: Response) => {
        try {
            const provider = req.params.provider as AIProvider;
            const timeWindow = req.query.timeWindow ? parseInt(req.query.timeWindow as string) : undefined;
            const stats = observabilityManager.getProviderStats(provider, timeWindow);
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get user stats
    router.get('/user/:userId', async (req: Request, res: Response) => {
        try {
            const { userId } = req.params;
            const timeWindow = req.query.timeWindow ? parseInt(req.query.timeWindow as string) : undefined;
            const stats = observabilityManager.getUserStats(userId, timeWindow);
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get recent alerts
    router.get('/alerts', async (req: Request, res: Response) => {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
            const alerts = observabilityManager.getRecentAlerts(limit);
            res.json({ success: true, data: alerts });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get cache stats
    router.get('/cache', async (req: Request, res: Response) => {
        try {
            const stats = cacheManager.getStats();
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get API key stats
    router.get('/api-keys', async (req: Request, res: Response) => {
        try {
            const stats = apiKeyManager.getAggregatedStats();
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get all API keys
    router.get('/api-keys/all', async (req: Request, res: Response) => {
        try {
            const keys = apiKeyManager.getAllKeys();
            res.json({ success: true, data: keys });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Add API key
    router.post('/api-keys', async (req: Request, res: Response) => {
        try {
            const { provider, key, label } = req.body;
            const newKey = await apiKeyManager.addKey(provider, key, label);
            res.json({ success: true, data: newKey });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Remove API key
    router.delete('/api-keys/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await apiKeyManager.removeKey(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Toggle API key active
    router.post('/api-keys/:id/toggle', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await apiKeyManager.toggleKeyActive(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get logs
    router.get('/logs', async (req: Request, res: Response) => {
        try {
            // Mock implementation - replace with actual logger integration
            const logs = [
                { timestamp: Date.now(), level: 'info', message: 'System started' }
            ];
            res.json({ success: true, data: logs });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
}
