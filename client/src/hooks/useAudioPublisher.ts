import { useEffect, useRef, useState } from 'react';
// FIXED: Default import instead of a named import to resolve "Recorder is not a constructor"
import Recorder from 'opus-recorder'; 
import { createLogger } from '../logger';

const logger = createLogger('AudioPub');

interface UseAudioPublisherProps {
  sendBinary: (buffer: ArrayBuffer) => void;
  active: boolean;
}

export function useAudioPublisher({ sendBinary, active }: UseAudioPublisherProps) {
  const recorderRef = useRef<any>(null); // Safely use 'any' if you lack strict @types/opus-recorder
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // If deactivated, gracefully shut down the recorder and workers
    if (!active) {
      if (recorderRef.current) {
        recorderRef.current.stop();
        // CRITICAL: close() destroys the Web Workers and audio contexts. 
        // Without this, your browser will leak memory every time you toggle recording.
        if (typeof recorderRef.current.close === 'function') {
          recorderRef.current.close();
        }
        recorderRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    // Recorder handles getUserMedia internally with the constraints we provide
    const recorder = new Recorder({
      encoderPath: '/opus-recorder/encoderWorker.min.js',
      streamPages: true,
      encoderApplication: 2049,       // OPUS_APPLICATION_AUDIO
      encoderFrameSize: 20,           // 20ms frames
      encoderSampleRate: 16000,       // good for speech, lower bandwidth
      numberOfChannels: 1,
      sourceChannelConstraints: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // FIXED: Use the correct API callback property rather than .on('data')
    // opus-recorder passes a Uint8Array to this callback.
    recorder.ondataavailable = (typedArray: Uint8Array) => {
      // Your sendBinary function expects an ArrayBuffer, so we extract the underlying buffer
      sendBinary(typedArray.buffer); 
    };

    recorder.start()
      .then(() => {
        recorderRef.current = recorder;
        setIsRecording(true);
        logger.info('Audio publisher started');
      })
      .catch((err: Error) => {
        logger.error('Failed to start audio publisher', err);
      });

    // Cleanup when the component unmounts
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
        if (typeof recorderRef.current.close === 'function') {
          recorderRef.current.close();
        }
        recorderRef.current = null;
      }
    };
  }, [active, sendBinary]);

  return { isRecording };
}
