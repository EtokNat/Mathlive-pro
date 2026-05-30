import React, { useEffect, useState, useCallback } from 'react';
import { createLogger } from './logger';
import { useWebSocket } from './hooks/useWebSocket';
import ReconnectionBanner from './components/ReconnectionBanner';
import Whiteboard from './components/Whiteboard';
import './index.css';

const logger = createLogger('App');

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://mathlive-pro.onrender.com';

function App() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [strokes, setStrokes] = useState<any[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      logger.info('beforeinstallprompt captured');
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    const requestStorage = async () => {
      if (navigator.storage && navigator.storage.persist) {
        try {
          const isPersisted = await navigator.storage.persist();
          logger.info(`Persistent storage ${isPersisted ? 'granted' : 'denied'}`);
          setStoragePersisted(isPersisted);
        } catch (err) {
          logger.error('Failed to request persistent storage', err);
        }
      }
    };
    requestStorage();
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      logger.info(`Install prompt outcome: ${choice.outcome}`);
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') setIsInstalled(true);
    } catch (err) {
      logger.error('Install prompt failed', err);
    }
  };

  const onMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'room-created':
        setRoomCode(data.roomCode);
        setJoined(true);
        break;
      case 'room-joined':
        setJoined(true);
        break;
      case 'stroke':
        setStrokes((prev) => [...prev, data]);
        break;
      case 'error':
        logger.error('Server error', data.error);
        break;
      default:
        break;
    }
  }, []);

  const { state: wsState, send } = useWebSocket({
    url: WS_URL,
    onMessage,
  });

  const createRoom = () => {
    send({ type: 'create-room' });
  };

  const joinRoom = () => {
    const code = prompt('Enter room code:');
    if (code) {
      send({ type: 'join-room', roomCode: code });
    }
  };

  const onStroke = (stroke: any) => {
    send({ type: 'stroke', ...stroke });
  };

  return (
    <div className="app-container">
      <ReconnectionBanner state={wsState} />
      <h1>MathLive Pro</h1>
      <p>Welcome to the future of collaborative math learning.</p>

      {!joined && (
        <div>
          <button onClick={createRoom}>Create Room</button>
          <button onClick={joinRoom}>Join Room</button>
        </div>
      )}
      {joined && roomCode && <p>Room: {roomCode}</p>}

      {joined && (
        <Whiteboard onStroke={onStroke} incomingStrokes={strokes} />
      )}

      {!joined && (
        <>
          {!isInstalled && installPrompt && (
            <div className="install-banner">
              <p>Install this app on your device for the best experience.</p>
              <button onClick={handleInstall}>Install</button>
            </div>
          )}
          {isInstalled && <p>✅ App installed</p>}
          <div className="storage-status">
            {storagePersisted ? (
              <p>✅ Persistent storage granted – offline mode fully supported.</p>
            ) : (
              <p>⚠️ Persistent storage not granted. Some offline features may be limited.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
