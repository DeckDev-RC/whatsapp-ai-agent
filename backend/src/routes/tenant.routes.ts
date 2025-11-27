import { Router, Request, Response } from 'express';
import type { DatabaseManager } from '../managers/database/DatabaseManager';
import type { Tenant, WhatsAppNumber } from '../types';

export function tenantRoutes(databaseManager: DatabaseManager) {
    const router = Router();

    // ===== Tenants =====

    // Get all tenants
    router.get('/', async (req: Request, res: Response) => {
        try {
            const tenants = await databaseManager.getAllTenants();
            res.json({ success: true, data: tenants });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Create tenant
    router.post('/', async (req: Request, res: Response) => {
        try {
            const tenant: Partial<Tenant> = req.body;
            const created = await databaseManager.createTenant(tenant);
            res.json({ success: true, data: created });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Update tenant
    router.put('/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const tenant: Partial<Tenant> = req.body;
            const updated = await databaseManager.updateTenant(id, tenant);
            res.json({ success: true, data: updated });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Delete tenant
    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await databaseManager.deleteTenant(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ===== WhatsApp Numbers =====

    // Get all WhatsApp numbers
    router.get('/whatsapp-numbers', async (req: Request, res: Response) => {
        try {
            const numbers = await databaseManager.getAllWhatsAppNumbers();
            res.json({ success: true, data: numbers });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Create WhatsApp number
    router.post('/whatsapp-numbers', async (req: Request, res: Response) => {
        try {
            const number: Partial<WhatsAppNumber> = req.body;
            const created = await databaseManager.createWhatsAppNumber(number);
            res.json({ success: true, data: created });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Update WhatsApp number
    router.put('/whatsapp-numbers/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const number: Partial<WhatsAppNumber> = req.body;
            const updated = await databaseManager.updateWhatsAppNumber(id, number);
            res.json({ success: true, data: updated });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Delete WhatsApp number
    router.delete('/whatsapp-numbers/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await databaseManager.deleteWhatsAppNumber(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ===== Orders =====

    // Get orders by tenant
    router.get('/:tenantId/orders', async (req: Request, res: Response) => {
        try {
            const { tenantId } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
            const orders = await databaseManager.getOrdersByTenant(tenantId, limit);
            res.json({ success: true, data: orders });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Search orders
    router.get('/orders/search', async (req: Request, res: Response) => {
        try {
            const query = req.query.q as string;
            const orders = await databaseManager.searchOrders(query);
            res.json({ success: true, data: orders });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
}
