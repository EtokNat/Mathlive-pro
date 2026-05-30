import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { createLogger } from './logger';
import {
  createRoom,
  joinRoom,
  leaveAllRooms,
  findRoomByConnection,
  Room,
} from './rooms';

const logger = createLogger('SERVER');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('MathLive Pro server is running.');
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let nextId = 1;
const connectionMap = new Map<WebSocket, string>();

// Helper to subscribe a WebSocket to all room events
function subscribeToRoom(ws: WebSocket, connectionId: string, room: Room) {
  const onParticipantJoined = (id: string) => {
    if (id !== connectionId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'participant-joined', connectionId: id }));
    }
  };

  const onStroke = (data: any) => {
    // Forward stroke to everyone except the sender
    if (data.sender !== connectionId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  const onViewport = (data: any) => {
    if (data.sender !== connectionId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  room.emitter.on('participant-joined', onParticipantJoined);
  room.emitter.on('stroke', onStroke);
  room.emitter.on('viewport', onViewport);

  // Clean up when the socket disconnects
  ws.on('close', () => {
    room.emitter.off('participant-joined', onParticipantJoined);
    room.emitter.off('stroke', onStroke);
    room.emitter.off('viewport', onViewport);
  });
}

wss.on('connection', (ws: WebSocket) => {
  const connectionId = `conn_${nextId++}`;
  connectionMap.set(ws, connectionId);
  logger.info(`WebSocket connected: ${connectionId}`);

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 15000);

  ws.on('message', (data) => {
    let message: any;
    try {
      message = JSON.parse(data.toString());
    } catch (err: any) {
      logger.error(`Invalid JSON from ${connectionId}`, { raw: data.toString() });
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    logger.debug(`Message from ${connectionId}`, message);

    try {
      switch (message.type) {
        case 'create-room': {
          const room = createRoom(connectionId);
          // Subscribe the creator to room events
          subscribeToRoom(ws, connectionId, room);
          ws.send(JSON.stringify({ type: 'room-created', roomCode: room.id }));
          break;
        }
        case 'join-room': {
          const { roomCode } = message;
          if (!roomCode) {
            ws.send(JSON.stringify({ type: 'error', error: 'Missing roomCode' }));
            return;
          }
          const room = joinRoom(roomCode, connectionId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', error: 'Room not found' }));
            return;
          }

          // Subscribe the joiner to room events
          subscribeToRoom(ws, connectionId, room);
          ws.send(JSON.stringify({ type: 'room-joined', roomCode: room.id }));

          // Notify existing participants
          room.emitter.emit('participant-joined', connectionId);
          break;
        }
        case 'stroke': {
          const room = findRoomByConnection(connectionId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', error: 'Not in a room' }));
            return;
          }
          // Relay to all other subscribers
          room.emitter.emit('stroke', {
            ...message,
            sender: connectionId,
          });
          break;
        }
        case 'viewport': {
          const room = findRoomByConnection(connectionId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', error: 'Not in a room' }));
            return;
          }
          room.emitter.emit('viewport', {
            ...message,
            sender: connectionId,
          });
          break;
        }
        case 'pong': {
          // heartbeat
          break;
        }
        default:
          ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${message.type}` }));
      }
    } catch (err: any) {
      logger.error(`Error handling message from ${connectionId}`, { error: err.message, message });
      ws.send(JSON.stringify({ type: 'error', error: 'Internal server error' }));
    }
  });

  ws.on('close', () => {
    logger.info(`WebSocket disconnected: ${connectionId}`);
    clearInterval(pingInterval);
    leaveAllRooms(connectionId);
    connectionMap.delete(ws);
  });

  ws.on('error', (err) => {
    logger.error(`WebSocket error for ${connectionId}`, { message: err.message });
  });
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  wss.close(() => server.close(() => process.exit(0)));
});
