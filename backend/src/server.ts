import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';

// Routes
import { whatsappRoutes } from './routes/whatsapp.routes.js';
import { databaseRoutes } from './routes/database.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { tenantRoutes } from './routes/tenant.routes.js';
import { agentRoutes } from './routes/agent.routes.js';
import { ragRoutes } from './routes/rag.routes.js';
import { metricsRoutes } from './routes/metrics.routes.js';

// WebSocket handlers
import { setupWebSocketHandlers } from './websocket/handlers.js';

// Managers
import { WhatsAppManager } from './managers/whatsapp/WhatsAppManager.js';
import { databaseManager } from './managers/database/DatabaseManager.js';
import { AIManager } from './managers/ai/AIManager.js';

// Logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// ============================================
// SERVER SETUP
// ============================================

const app: Express = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

// ============================================
// MANAGERS INITIALIZATION
// ============================================

const whatsappManager = new WhatsAppManager();
const aiManager = new AIManager();

// Auto-connect WhatsApp if credentials exist
setTimeout(async () => {
  try {
    await whatsappManager.autoConnect();
    logger.info('WhatsApp auto-connect attempt completed');
  } catch (error) {
    logger.error({ error }, 'WhatsApp auto-connect failed');
  }
}, 2000);

// ============================================
// ROUTES
// ============================================

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/whatsapp', whatsappRoutes(whatsappManager));
app.use('/api/database', databaseRoutes(databaseManager));
app.use('/api/ai', aiRoutes(aiManager));
app.use('/api/tenants', tenantRoutes(databaseManager));
app.use('/api/agents', agentRoutes());
app.use('/api/rag', ragRoutes());
app.use('/api/metrics', metricsRoutes());

// ============================================
// WEBSOCKET
// ============================================

setupWebSocketHandlers(io, {
  whatsappManager,
  databaseManager,
  aiManager
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error({ err, url: req.url }, 'Error occurred');
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ============================================
// START SERVER
// ============================================

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📡 WebSocket server ready`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await whatsappManager.disconnect();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await whatsappManager.disconnect();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
