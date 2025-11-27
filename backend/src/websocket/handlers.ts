import { Server as SocketIOServer, Socket } from 'socket.io';
import type { WhatsAppManager } from '../managers/whatsapp/WhatsAppManager';
import type { DatabaseManager } from '../managers/database/DatabaseManager';
import type { AIManager } from '../managers/ai/AIManager';
import { processIncomingMessage } from './messageProcessor';

interface Managers {
    whatsappManager: WhatsAppManager;
    databaseManager: DatabaseManager;
    aiManager: AIManager;
}

export function setupWebSocketHandlers(io: SocketIOServer, managers: Managers) {
    const { whatsappManager, databaseManager, aiManager } = managers;

    io.on('connection', (socket: Socket) => {
        console.log(`[WebSocket] Client connected: ${socket.id}`);

        // ===== WhatsApp Events =====

        // QR Code updates
        const qrCodeListener = (qr: string) => {
            socket.emit('whatsapp:qr', qr);
        };

        // Status updates
        const statusListener = (status: any) => {
            socket.emit('whatsapp:status', status);
        };

        // Incoming messages
        const messageListener = async (context: any) => {
            // Emit to frontend
            socket.emit('whatsapp:message', {
                from: context.from,
                message: context.message
            });

            // Process message with AI
            await processIncomingMessage(context, { databaseManager, aiManager, whatsappManager });
        };

        // Typing indicators
        const typingListener = (indicator: any) => {
            socket.emit('whatsapp:typing', indicator);
        };

        // Register listeners
        whatsappManager.onMessage(messageListener);
        whatsappManager.onStatusUpdate(statusListener);
        whatsappManager.onTyping(typingListener);

        // ===== Client Events =====

        // Request current status
        socket.on('whatsapp:get-status', () => {
            const status = whatsappManager.getStatus();
            socket.emit('whatsapp:status', status);
        });

        // Disconnect handler
        socket.on('disconnect', () => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`);
            // Note: In production, you might want to implement proper cleanup
            // of listeners if you're tracking them per socket
        });
    });

    console.log('[WebSocket] Handlers configured');
}
