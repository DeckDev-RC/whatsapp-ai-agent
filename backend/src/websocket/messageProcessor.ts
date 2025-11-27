import type { MessageContext } from '../types';
import type { DatabaseManager } from '../managers/database/DatabaseManager';
import type { AIManager } from '../managers/ai/AIManager';
import type { WhatsAppManager } from '../managers/whatsapp/WhatsAppManager';
import { agentManager } from '../managers/services/AgentManager';

interface Managers {
    databaseManager: DatabaseManager;
    aiManager: AIManager;
    whatsappManager: WhatsAppManager;
}

/**
 * Processa mensagem recebida e gera resposta do agente
 */
export async function processIncomingMessage(
    context: MessageContext,
    managers: Managers
): Promise<void> {
    const { databaseManager, aiManager, whatsappManager } = managers;
    const startTime = Date.now();

    try {
        console.log(`[MessageProcessor] 📨 Processing message from ${context.from}`);
        console.log(`[MessageProcessor] Message: ${context.message?.substring(0, 100)}...`);

        // 1. Verificar se há agente atribuído para este contato
        const assignment = await agentManager.getAssignmentByContact(context.from);

        if (!assignment) {
            console.log(`[MessageProcessor] ⚠️ No agent assigned to ${context.from} - skipping`);
            return;
        }

        const agent = await agentManager.getAgent(assignment.agentId);
        if (!agent || !agent.isActive) {
            console.log(`[MessageProcessor] ⚠️ Agent ${assignment.agentId} not found or inactive`);
            return;
        }

    }
        }

// 7. Enviar resposta via WhatsApp
await whatsappManager.sendMessage(context.from, response);

const processingTime = Date.now() - startTime;
console.log(`[MessageProcessor] ✅ Message processed in ${processingTime}ms`);

    } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`[MessageProcessor] ❌ Error processing message (${processingTime}ms):`, error);

    // Tentar enviar mensagem de erro ao usuário
    try {
        await whatsappManager.sendMessage(
            context.from,
            'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.'
        );
    } catch (sendError) {
        console.error(`[MessageProcessor] Failed to send error message:`, sendError);
    }
}
}
