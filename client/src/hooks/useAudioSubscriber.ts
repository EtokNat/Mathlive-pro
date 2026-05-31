import { useRef, useCallback, useEffect } from 'react';
import { OggOpusDecoder } from 'ogg-opus-decoder';
import { createLogger } from '../logger';

const logger = createLogger('AudioSub');

export function useAudioSubscriber() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const decoderRef = useRef<OggOpusDecoder | null>(null);
  const nextPlayAt = useRef<number>(0);
  const isReady = useRef(false);

  const initAudio = useCallback(async () => {
    console.log('🔊 [AudioSub] initAudio called');
    if (isReady.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 16000 });
      if (ctx.state === 'suspended') {
        await ctx.resume();
        console.log('🔹 [AudioSub] AudioContext resumed');
      }

      const decoder = new OggOpusDecoder({ sampleRate: 16000, channels: 1 });
      await decoder.ready;
      console.log('✅ [AudioSub] OggOpusDecoder ready');

      audioCtxRef.current = ctx;
      decoderRef.current = decoder;
      nextPlayAt.current = ctx.currentTime + 0.01;
      isReady.current = true;
    } catch (err) {
      console.error('❌ [AudioSub] initAudio failed:', err);
    }
  }, []);

  const enqueueChunk = useCallback(async (chunk: ArrayBuffer) => {
    // Extract the timestamp from the first 8 bytes
    const view = new DataView(chunk);
    const sentTsMicro = view.getBigUint64(0, true);
    const sentMs = Number(sentTsMicro) / 1000;
    const nowMs = performance.now();
    const travelTime = nowMs - sentMs;
    console.log(`🎧 [4/5] Chunk received, travel time: ${travelTime.toFixed(2)} ms`);

    // Slice off the header to get the real audio data
    const audioData = new Uint8Array(chunk, 8);

    if (!isReady.current) {
      console.warn('⏳ [AudioSub] Not initialized yet – dropping chunk');
      return;
    }

    try {
      const ctx = audioCtxRef.current!;
      const decoder = decoderRef.current!;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const { channelData, samplesDecoded, sampleRate } = await decoder.decode(audioData);
      console.log(`🔹 [AudioSub] Decoded ${samplesDecoded} samples, rate ${sampleRate}`);

      if (samplesDecoded === 0) return;

      const buffer = ctx.createBuffer(1, samplesDecoded, sampleRate);
      buffer.getChannelData(0).set(channelData[0]);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      if (nextPlayAt.current < now) nextPlayAt.current = now;
      source.start(nextPlayAt.current);
      nextPlayAt.current += buffer.duration;
    } catch (err: any) {
      console.error('❌ [AudioSub] Decode error:', err);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (decoderRef.current) decoderRef.current.free();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  return { enqueueChunk, initAudio };
}
