// Export the processIncomingMessage function
// This is a stub - the actual implementation will be added later
import type { MessageContext } from '../types';
import type { DatabaseManager } from '../managers/database/DatabaseManager';
import type { AIManager } from '../managers/ai/AIManager';
import type { WhatsAppManager } from '../managers/whatsapp/WhatsAppManager';

interface Managers {
    databaseManager: DatabaseManager;
    aiManager: AIManager;
    whatsappManager: WhatsAppManager;
}

export async function processIncomingMessage(
    context: MessageContext,
    managers: Managers
): Promise<void> {
    // TODO: Implement message processing logic
    // For now, just log the message
    console.log(`[MessageProcessor] Received message from ${context.from}: ${context.message}`);

    // The full implementation from handlers.ts can be added here later
    // For now, this is just a placeholder to allow the build to succeed
}
