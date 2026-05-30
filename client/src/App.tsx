import React, { useEffect, useState, useCallback } from 'react';
import { createLogger } from './logger';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioPublisher } from './hooks/useAudioPublisher';
import { useAudioSubscriber } from './hooks/useAudioSubscriber';
import ReconnectionBanner from './components/ReconnectionBanner';
import Whiteboard from './components/Whiteboard';
import './index.css';

const logger = createLogger('App');
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://mathlive-pro.onrender.com';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function App() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [strokes, setStrokes] = useState<any[]>([]);
  const [audioActive, setAudioActive] = useState(false);

  const { enqueueChunk } = useAudioSubscriber();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    (async () => {
      if (navigator.storage?.persist) {
        const persisted = await navigator.storage.persist();
        setStoragePersisted(persisted);
      }
    })();
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setIsInstalled(true);
    setInstallPrompt(null);
  };

  const onMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'room-created':
        setRoomCode(data.roomCode);
        setJoined(true);
        setIsCreator(true);
        break;
      case 'room-joined':
        setJoined(true);
        break;
      case 'stroke':
        setStrokes(prev => [...prev, data]);
        break;
      case 'participant-joined':
        logger.info('Participant joined', data.connectionId);
        break;
      case 'error':
        logger.error('Server error', data.error);
        break;
    }
  }, []);

  const onAudioData = useCallback((buffer: ArrayBuffer) => {
    enqueueChunk(buffer);
  }, [enqueueChunk]);

  const { state: wsState, send, sendBinary } = useWebSocket({
    url: WS_URL,
    onMessage,
    onAudioData,
  });

  useAudioPublisher({ sendBinary, active: isCreator && audioActive });

  const createRoom = () => send({ type: 'create-room' });
  const joinRoom = () => {
    const code = prompt('Enter room code:');
    if (code) send({ type: 'join-room', roomCode: code });
  };

  const onStroke = (stroke: any) => send({ type: 'stroke', ...stroke });

  return (
    <div className="app-container">
      <ReconnectionBanner state={wsState} />
      <h1>MathLive Pro</h1>

      {!joined ? (
        <>
          <p>Welcome to the future of collaborative math learning.</p>
          <button onClick={createRoom}>Create Room</button>
          <button onClick={joinRoom}>Join Room</button>
          {!isInstalled && installPrompt && (
            <div className="install-banner">
              <p>Install this app for the best experience.</p>
              <button onClick={handleInstall}>Install</button>
            </div>
          )}
          <div className="storage-status">
            {storagePersisted ? '✅ Persistent storage granted.' : '⚠️ Storage not persisted.'}
          </div>
        </>
      ) : (
        <>
          {roomCode && <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Room Code: {roomCode}</p>}
          {isCreator && !audioActive && (
            <div className="splash">
              <button onClick={() => setAudioActive(true)}>🎙️ Start Audio Class</button>
            </div>
          )}
          {isCreator && audioActive && <p style={{ color: '#ef4444', fontWeight: 'bold' }}>🔴 Broadcasting audio</p>}
          <Whiteboard onStroke={onStroke} incomingStrokes={strokes} />
        </>
      )}
    </div>
  );
}

export default App;
