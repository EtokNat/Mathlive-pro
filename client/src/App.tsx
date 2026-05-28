import React, { useEffect, useState } from 'react';
import { createLogger } from './logger';

const logger = createLogger('App');

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function App() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [storagePersisted, setStoragePersisted] = useState(false);

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
      } else {
        logger.warn('Persistent storage API not available');
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
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch (err) {
      logger.error('Install prompt failed', err);
    }
  };

  return (
    <div className="app-container">
      <h1>MathLive Pro</h1>
      <p>Welcome to the future of collaborative math learning.</p>

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
    </div>
  );
}

export default App;
