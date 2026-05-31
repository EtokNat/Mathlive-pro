import { useRef, useCallback, useEffect } from 'react';

export function useAudioSubscriber() {
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const chunkQueue = useRef<ArrayBuffer[]>([]);
  const hasReceivedHeader = useRef(false);

  const initAudio = useCallback(async () => {
    if (audioElRef.current) return;

    console.log('🚀 [AudioSub] Initializing Native MediaSource...');
    const mediaSource = new MediaSource();
    
    // Create the audio element and force it onto the screen
    const audioEl = document.createElement('audio');
    audioEl.src = URL.createObjectURL(mediaSource);
    audioEl.autoplay = true;
    audioEl.controls = true; // We need to see the play button and timeline!
    
    // Style it so it floats in the bottom right corner
    audioEl.style.position = 'fixed';
    audioEl.style.bottom = '20px';
    audioEl.style.right = '20px';
    audioEl.style.zIndex = '9999';
    audioEl.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
    document.body.appendChild(audioEl);
    
    audioElRef.current = audioEl;
    mediaSourceRef.current = mediaSource;

    // --- DIAGNOSTIC EVENT LISTENERS ---
    audioEl.addEventListener('playing', () => console.log('▶️ [AudioSub] BROWSER CONFIRMS AUDIO IS PLAYING!'));
    audioEl.addEventListener('waiting', () => console.warn('⏳ [AudioSub] Browser is WAITING for larger chunks...'));
    audioEl.addEventListener('stalled', () => console.warn('🛑 [AudioSub] Audio stalled! Buffer starved.'));
    audioEl.addEventListener('error', () => console.error('❌ [AudioSub] Audio element error:', audioEl.error));

    mediaSource.addEventListener('sourceopen', () => {
      console.log('✅ [AudioSub] MediaSource open. Creating SourceBuffer...');
      try {
        const sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs="opus"');
        sourceBufferRef.current = sourceBuffer;

        sourceBuffer.addEventListener('updateend', () => {
          if (chunkQueue.current.length > 0 && !sourceBuffer.updating) {
            try {
              sourceBuffer.appendBuffer(chunkQueue.current.shift()!);
            } catch (err) {
              console.error('❌ [AudioSub] Buffer append error:', err);
            }
          }
        });
      } catch (e) {
        console.error('❌ [AudioSub] Your browser does not support audio/webm codecs=opus', e);
      }
    });

    try {
      await audioEl.play();
      console.log('🔊 [AudioSub] Auto-play triggered successfully.');
    } catch (err) {
      console.error('❌ [AudioSub] Auto-play blocked. You must click play manually.', err);
    }
  }, []);

  const enqueueChunk = useCallback((chunk: ArrayBuffer) => {
    if (!hasReceivedHeader.current) {
      hasReceivedHeader.current = true;
    }

    const sourceBuffer = sourceBufferRef.current;
    if (!sourceBuffer || sourceBuffer.updating) {
      chunkQueue.current.push(chunk);
    } else {
      try {
        if (chunkQueue.current.length > 0) {
           chunkQueue.current.push(chunk);
           sourceBuffer.appendBuffer(chunkQueue.current.shift()!);
        } else {
           sourceBuffer.appendBuffer(chunk);
        }
      } catch (err) {
        console.error('❌ [AudioSub] Failed to append buffer.', err);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.removeAttribute('src');
        audioElRef.current.load();
        if (document.body.contains(audioElRef.current)) {
          document.body.removeChild(audioElRef.current);
        }
      }
    };
  }, []);

  return { enqueueChunk, initAudio };
}
