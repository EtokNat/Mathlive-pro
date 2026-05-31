import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { createLogger } from './logger';
import { createRoom, joinRoom, leaveAllRooms, findRoomByConnection, Room } from './rooms';

const logger = createLogger('SERVER');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => res.send('MathLive Pro server is running.'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let nextId = 1;
const connectionMap = new Map<WebSocket, string>();
const connectionIdToWs = new Map<string, WebSocket>();

function findWsByConnectionId(id: string): WebSocket | undefined {
  return connectionIdToWs.get(id);
}

function subscribeToRoom(ws: WebSocket, connectionId: string, room: Room) {
  const onParticipantJoined = (id: string) => {
    if (id !== connectionId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'participant-joined', connectionId: id }));
    }
  };
  const onStroke = (data: any) => {
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
  ws.on('close', () => {
    room.emitter.off('participant-joined', onParticipantJoined);
    room.emitter.off('stroke', onStroke);
    room.emitter.off('viewport', onViewport);
  });
}

wss.on('connection', (ws: WebSocket) => {
  const connectionId = `conn_${nextId++}`;
  connectionMap.set(ws, connectionId);
  connectionIdToWs.set(connectionId, ws);
  logger.info(`WebSocket connected: ${connectionId}`);

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
  }, 15000);

  ws.on('message', (rawData: any, isBinary: boolean) => {
    // Binary path – audio relay
    if (isBinary) {
      const byteSize = rawData.length || rawData.byteLength;
      logger.info(`☁️ [2/5] Server received binary data: ${byteSize} bytes from ${connectionId}`);
      
      const room = findRoomByConnection(connectionId);
      if (!room) {
        logger.warn(`⚠️ [SERVER] Dropped binary data: ${connectionId} is not in a room`);
        return; 
      }
      
      let sentCount = 0;
      room.participants.forEach((id) => {
        if (id !== connectionId) {
          const otherWs = findWsByConnectionId(id);
          if (otherWs && otherWs.readyState === WebSocket.OPEN) {
            otherWs.send(rawData, { binary: true });
            sentCount++;
          }
        }
      });
      logger.info(`☁️ [3/5] Server relayed ${byteSize} bytes to ${sentCount} listeners`);
      return;
    }

    // JSON path
    let message: any;
    try {
      message = JSON.parse(rawData.toString());
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    try {
      switch (message.type) {
        case 'create-room': {
          const newRoom = createRoom(connectionId);
          subscribeToRoom(ws, connectionId, newRoom);
          ws.send(JSON.stringify({ type: 'room-created', roomCode: newRoom.id }));
          break;
        }
        case 'join-room': {
          const { roomCode } = message;
          if (!roomCode) {
            ws.send(JSON.stringify({ type: 'error', error: 'Missing roomCode' }));
            return;
          }
          const targetRoom = joinRoom(roomCode, connectionId);
          if (!targetRoom) {
            ws.send(JSON.stringify({ type: 'error', error: 'Room not found' }));
            return;
          }
          subscribeToRoom(ws, connectionId, targetRoom);
          ws.send(JSON.stringify({ type: 'room-joined', roomCode: targetRoom.id }));
          targetRoom.emitter.emit('participant-joined', connectionId);
          break;
        }
        case 'stroke': {
          const room = findRoomByConnection(connectionId);
          if (room) room.emitter.emit('stroke', { ...message, sender: connectionId });
          break;
        }
        case 'viewport': {
          const room = findRoomByConnection(connectionId);
          if (room) room.emitter.emit('viewport', { ...message, sender: connectionId });
          break;
        }
        case 'pong':
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', error: `Unknown type: ${message.type}` }));
      }
    } catch (err: any) {
      logger.error(`Error processing message from ${connectionId}`, { error: err.message });
    }
  });

  ws.on('close', () => {
    logger.info(`WebSocket disconnected: ${connectionId}`);
    clearInterval(pingInterval);
    leaveAllRooms(connectionId);
    connectionMap.delete(ws);
    connectionIdToWs.delete(connectionId);
  });
});

server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
