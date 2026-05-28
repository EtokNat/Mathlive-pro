import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { createLogger } from './logger'; // we'll create this next

const logger = createLogger('SERVER');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  logger.info('New WebSocket connection');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      logger.debug('Received WS message', message);
      // Echo back for now
      ws.send(JSON.stringify({ echo: message }));
    } catch (err: any) {
      logger.error('Invalid WebSocket message', { error: err.message, raw: data.toString() });
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });

  ws.on('close', (code, reason) => {
    logger.info(`WebSocket closed: ${code}`, reason?.toString());
  });

  ws.on('error', (err) => {
    logger.error('WebSocket error', { message: err.message });
  });
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  wss.close(() => {
    server.close(() => process.exit(0));
  });
});
