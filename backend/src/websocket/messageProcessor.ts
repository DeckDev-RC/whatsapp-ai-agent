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

        console.log(`[MessageProcessor] 🤖 Agent assigned: ${agent.name}`);

        // 2. Salvar mensagem do usuário no banco
        if (databaseManager.isConnected()) {
            try {
                await databaseManager.saveConversation({
                    tenant_id: agent.tenantId || 'default',
                    phone_number: context.from,
                    message: context.message,
                    role: 'user'
                });
            } catch (error) {
                console.error(`[MessageProcessor] Error saving user message:`, error);
            }
        }

        // 3. Buscar histórico de conversas (últimas 10 mensagens)
        let conversationHistory: any[] = [];
        if (databaseManager.isConnected()) {
            try {
                const conversations = await databaseManager.getConversationsByPhone(context.from, 10);
                conversationHistory = conversations || [];
            } catch (error) {
                console.error(`[MessageProcessor] Error fetching history:`, error);
            }
        }

        // 4. Construir prompt com contexto do agente
        const systemPrompt = agent.systemPrompt || `Você é ${agent.name}, um assistente virtual prestativo.`;

        let prompt = `${systemPrompt}\n\n`;

        // Adicionar histórico se houver
        if (conversationHistory.length > 0) {
            prompt += `Histórico da conversa:\n`;
            conversationHistory.forEach(conv => {
                const role = conv.role === 'user' ? 'Cliente' : 'Você';
                prompt += `${role}: ${conv.message}\n`;
            });
            prompt += `\n`;
        }

        prompt += `Cliente: ${context.message}\nVocê:`;

        console.log(`[MessageProcessor] 🧠 Generating AI response...`);

        // 5. Gerar resposta com IA
        const response = await aiManager.generateResponse(prompt, true);

        console.log(`[MessageProcessor] ✅ AI response generated (${response.length} chars)`);

        // 6. Salvar resposta do agente no banco
        if (databaseManager.isConnected()) {
            try {
                await databaseManager.saveConversation({
                    tenant_id: agent.tenantId || 'default',
                    phone_number: context.from,
                    message: response,
                    role: 'assistant'
                });
            } catch (error) {
                console.error(`[MessageProcessor] Error saving assistant message:`, error);
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
