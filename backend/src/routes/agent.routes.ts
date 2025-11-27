import { Router, Request, Response } from 'express';
import { agentManager } from '../managers/services/AgentManager';
import type { AIProvider } from '../types';

export function agentRoutes() {
    const router = Router();

    // Get all agents
    router.get('/', async (req: Request, res: Response) => {
        try {
            const agents = await agentManager.getAllAgents();
            res.json({ success: true, data: agents });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get agent by ID
    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const agent = await agentManager.getAgent(id);
            res.json({ success: true, data: agent });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Create agent
    router.post('/', async (req: Request, res: Response) => {
        try {
            const data = req.body;
            const agent = await agentManager.createAgent(data);
            res.json({ success: true, data: agent });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Update agent
    router.put('/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const updates = req.body;
            const agent = await agentManager.updateAgent(id, updates);
            res.json({ success: true, data: agent });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Delete agent
    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await agentManager.deleteAgent(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Toggle agent active
    router.post('/:id/toggle-active', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const agent = await agentManager.toggleAgentActive(id);
            res.json({ success: true, data: agent });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get active agents
    router.get('/active/list', async (req: Request, res: Response) => {
        try {
            const agents = await agentManager.getActiveAgents();
            res.json({ success: true, data: agents });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get agents by provider
    router.get('/provider/:provider', async (req: Request, res: Response) => {
        try {
            const provider = req.params.provider as AIProvider;
            const agents = await agentManager.getAgentsByProvider(provider);
            res.json({ success: true, data: agents });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get stats
    router.get('/stats/all', async (req: Request, res: Response) => {
        try {
            const stats = await agentManager.getStats();
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ===== Agent Assignments =====

    // Get all assignments
    router.get('/assignments/all', async (req: Request, res: Response) => {
        try {
            const assignments = await agentManager.getAllAssignments();
            res.json({ success: true, data: assignments });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Assign agent to contact
    router.post('/assignments', async (req: Request, res: Response) => {
        try {
            const { agentId, contactPhone, contactName } = req.body;
            const assignment = await agentManager.assignAgentToContact(agentId, contactPhone, contactName);
            res.json({ success: true, data: assignment });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Remove assignment
    router.delete('/assignments/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await agentManager.removeAssignment(id);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get assignment by contact
    router.get('/assignments/contact/:phone', async (req: Request, res: Response) => {
        try {
            const { phone } = req.params;
            const assignment = await agentManager.getAssignmentByContact(phone);
            res.json({ success: true, data: assignment });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Get agent for contact
    router.get('/for-contact/:phone', async (req: Request, res: Response) => {
        try {
            const { phone } = req.params;
            const agent = await agentManager.getAgentForContact(phone);
            res.json({ success: true, data: agent });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
}
