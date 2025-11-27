# Export the processIncomingMessage function from handlers
# This file extracts only the message processing logic
import type { MessageContext } from '../types';
import type { DatabaseManager } from '../managers/DatabaseManager';
import type { AIManager } from '../managers/AIManager';
import type { WhatsAppManager } from '../managers/WhatsAppManager';

interface Managers {
    databaseManager: DatabaseManager;
    aiManager: AIManager;
    whatsappManager: WhatsAppManager;
}

// This function will be implemented by copying the processIncomingMessage
// from the original handlers.ts file
export async function processIncomingMessage(
    context: MessageContext,
    managers: Managers
): Promise<void> {
    // Import the actual implementation from the copied file
    const { processIncomingMessage: processMessage } = await import('./handlers');
    return processMessage(context, managers);
}
