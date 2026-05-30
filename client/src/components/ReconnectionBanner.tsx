import React from 'react';
import type { ConnectionState } from '../hooks/useWebSocket';

interface Props {
  state: ConnectionState;
}

export default function ReconnectionBanner({ state }: Props) {
  if (state === 'OPEN') return null;

  const messages: Record<ConnectionState, string> = {
    CONNECTING: 'Connecting to server…',
    OPEN: '',
    RECONNECTING: 'Connection lost. Reconnecting…',
    CLOSED: 'Connection closed. Please refresh the page.',
  };

  return (
    <div className="reconnection-banner">
      <span>{messages[state]}</span>
    </div>
  );
}
