import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta as any).env?.VITE_API_URL || '';

class WebSocketClient {
    private socket: Socket | null = null;
    private listeners: Map<string, Set<Function>> = new Map();

    connect() {
        if (this.socket?.connected) {
            return this.socket;
        }

        this.socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
            console.log('[WebSocket] Connected');
        });

        this.socket.on('disconnect', () => {
            console.log('[WebSocket] Disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('[WebSocket] Connection error:', error);
        });

        // Setup event forwarding
        this.setupEventForwarding();

        return this.socket;
    }

    private setupEventForwarding() {
        if (!this.socket) return;

        // WhatsApp events
        this.socket.on('whatsapp:qr', (qr: string) => {
            this.emit('whatsapp:qr', qr);
        });

        this.socket.on('whatsapp:status', (status: any) => {
            this.emit('whatsapp:status', status);
        });

        this.socket.on('whatsapp:message', (data: any) => {
            this.emit('whatsapp:message', data);
        });

        this.socket.on('whatsapp:typing', (indicator: any) => {
            this.emit('whatsapp:typing', indicator);
        });
    }

    on(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    private emit(event: string, ...args: any[]) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(...args));
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.listeners.clear();
    }

    // Request current WhatsApp status
    requestStatus() {
        if (this.socket?.connected) {
            this.socket.emit('whatsapp:get-status');
        }
    }
}

export const socket = new WebSocketClient();

// Auto-connect on import
socket.connect();
