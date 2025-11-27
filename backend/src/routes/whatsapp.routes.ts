import { Router, Request, Response } from 'express';
import type { WhatsAppManager } from '../managers/whatsapp/WhatsAppManager';

export function whatsappRoutes(whatsappManager: WhatsAppManager) {
    const router = Router();

    // Get WhatsApp status
    router.get('/status', async (req: Request, res: Response) => {
        try {
            const status = whatsappManager.getStatus();
            res.json({ success: true, data: status });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Connect WhatsApp (generates QR code)
    router.post('/connect', async (req: Request, res: Response) => {
        try {
            await whatsappManager.connect();
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Disconnect WhatsApp
    router.post('/disconnect', async (req: Request, res: Response) => {
        try {
            await whatsappManager.disconnect();
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Clear authentication
    router.post('/clear-auth', async (req: Request, res: Response) => {
        try {
            await whatsappManager.clearAuth();
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Send message
    router.post('/send-message', async (req: Request, res: Response) => {
        try {
            const { to, message } = req.body;
            await whatsappManager.sendMessage(to, message);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get contacts
    router.get('/contacts', async (req: Request, res: Response) => {
        try {
            const contacts = await whatsappManager.getContacts();
            res.json({ success: true, data: contacts });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
}
