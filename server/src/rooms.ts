// server/src/rooms.ts
import { EventEmitter } from 'events';
import { createLogger } from './logger';

const logger = createLogger('ROOMS');

export interface Room {
  id: string;
  participants: Set<string>; // connection ids
  emitter: EventEmitter;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  // 6-character alphanumeric, uppercase for readability
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createRoom(connectionId: string): Room {
  let code = generateCode();
  // avoid collisions (unlikely but safe)
  while (rooms.has(code)) {
    code = generateCode();
  }
  const room: Room = {
    id: code,
    participants: new Set([connectionId]),
    emitter: new EventEmitter(),
  };
  rooms.set(code, room);
  logger.info(`Room created: ${code} by connection ${connectionId}`);
  return room;
}

export function joinRoom(code: string, connectionId: string): Room | null {
  const room = rooms.get(code);
  if (!room) {
    logger.warn(`Failed to join room ${code}: not found`);
    return null;
  }
  room.participants.add(connectionId);
  logger.info(`Connection ${connectionId} joined room ${code}`);
  return room;
}

export function leaveAllRooms(connectionId: string): void {
  for (const [code, room] of rooms.entries()) {
    if (room.participants.has(connectionId)) {
      room.participants.delete(connectionId);
      logger.info(`Connection ${connectionId} left room ${code}`);
      if (room.participants.size === 0) {
        rooms.delete(code);
        logger.info(`Room ${code} deleted (empty)`);
      }
    }
  }
}

export function findRoomByConnection(connectionId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.participants.has(connectionId)) return room;
  }
  return undefined;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function resetRooms(): void {
  rooms.clear();
  logger.info('All rooms reset');
}
