import { useEffect, useRef, useState } from 'react';
import { createLogger } from '../logger';

const logger = createLogger('AudioPub');

interface UseAudioPublisherProps {
  sendBinary: (buffer: ArrayBuffer) => void;
  active: boolean;
}

export function useAudioPublisher({ sendBinary, active }: UseAudioPublisherProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!active) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
      },
    }).then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // Prefer WebM with Opus, fallback to WebM
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
        options.mimeType = 'audio/webm; codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      } else {
        logger.error('No supported WebM mime type for MediaRecorder');
        return;
      }

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          event.data.arrayBuffer().then((buffer) => {
            logger.info(`🎤 [1/5] Captured WebM chunk: ${buffer.byteLength} bytes`);
            sendBinary(buffer);
          });
        }
      };

      mediaRecorder.start(20); // emit chunk every 20ms for low latency

      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      logger.info('🎙️ Audio publisher (MediaRecorder) started');
    }).catch((err) => {
      logger.error('❌ Failed to start audio publisher', err);
    });

    return () => {
      cancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [active, sendBinary]);

  return { isRecording };
}
