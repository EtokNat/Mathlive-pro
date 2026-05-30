import { useRef, useCallback, useEffect } from 'react';
import { OpusDecoder } from 'opus-decoder';
import { createLogger } from '../logger';

const logger = createLogger('AudioSub');

export function useAudioSubscriber() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const decoderRef = useRef<OpusDecoder | null>(null);
  const nextPlayAt = useRef<number>(0);

  // Enqueue a raw audio chunk for decoding and scheduled playback
  const enqueueChunk = useCallback(async (chunk: ArrayBuffer) => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
        decoderRef.current = new OpusDecoder({ sampleRate: 16000, channels: 1 });
        await decoderRef.current.ready;
        nextPlayAt.current = audioCtxRef.current.currentTime;
      }

      const ctx = audioCtxRef.current;
      const decoder = decoderRef.current;

      // Auto-resume if browser suspended audio context
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const { channelData, samplesDecoded } = await decoder.decode(new Uint8Array(chunk));
      if (samplesDecoded === 0) return;

      const buffer = ctx.createBuffer(1, samplesDecoded, 16000);
      buffer.getChannelData(0).set(channelData[0]);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      if (nextPlayAt.current < now) {
        nextPlayAt.current = now;
      }
      source.start(nextPlayAt.current);
      nextPlayAt.current += buffer.duration;
    } catch (err) {
      logger.error('Error rendering audio frame', err);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (decoderRef.current) {
        decoderRef.current.free();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return { enqueueChunk };
}
