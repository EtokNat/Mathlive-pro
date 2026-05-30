// server/src/rooms.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  leaveAllRooms,
  findRoomByConnection,
  resetRooms,
} from './rooms';

describe('Room Manager', () => {
  beforeEach(() => {
    resetRooms();
  });

  it('creates a room with a unique code', () => {
    const room = createRoom('conn1');
    expect(room.id).toHaveLength(6);
    expect(room.participants.has('conn1')).toBe(true);
  });

  it('allows a second connection to join an existing room', () => {
    const room = createRoom('conn1');
    const joined = joinRoom(room.id, 'conn2');
    expect(joined).not.toBeNull();
    expect(joined?.participants.has('conn2')).toBe(true);
  });

  it('returns null when joining a nonexistent room', () => {
    expect(joinRoom('XXXXXX', 'conn1')).toBeNull();
  });

  it('finds room by connection', () => {
    const room = createRoom('conn1');
    const found = findRoomByConnection('conn1');
    expect(found).toBeDefined();
    expect(found?.id).toBe(room.id);
  });

  it('removes connection from room on leaveAllRooms and deletes empty room', () => {
    const room = createRoom('conn1');
    joinRoom(room.id, 'conn2');
    leaveAllRooms('conn1');
    expect(room.participants.has('conn1')).toBe(false);
    expect(room.participants.size).toBe(1); // conn2 still there
    leaveAllRooms('conn2');
    // Room should be deleted from map
    const found = findRoomByConnection('conn2');
    expect(found).toBeUndefined();
  });
});
