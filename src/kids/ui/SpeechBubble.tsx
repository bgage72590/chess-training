// Pip's speech bubble: big friendly text with karaoke highlighting and a speaker button.
import { useLayoutEffect, useRef } from 'react';
import { useSpeech } from '../player/speech';
import { KidsIcon } from './KidsIcon';

export function SpeechBubble({ text, token, onSpeak, tail = 'left' }: { text: string; token?: number; onSpeak?: () => void; tail?: 'left' | 'top' | 'none' }) {
  const sp = useSpeech();
  const active = token != null && sp.token === token && sp.word >= 0;
  const words = text.split(/(\s+)/);
  let wi = -1;
  // A long line is never cut off: in a bubble with a height cap (the player on a phone) the text
  // shrinks a little, down to 15px, until it fits.
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current;
      const t = b?.querySelector<HTMLElement>('.k-bubble-text');
      if (!b || !t) return;
      t.style.fontSize = '';
      // offsetHeight ignores the line's settle-in animation, which scrollHeight would count.
      const cs = getComputedStyle(b);
      const room = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      let px = parseFloat(getComputedStyle(t).fontSize);
      while (t.offsetHeight > room + 1 && px > 15) {
        px -= 1;
        t.style.fontSize = `${px}px`;
      }
    };
    fit();
    void document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [text]);
  return (
    <div ref={box} className={`k-bubble tail-${tail}`}>
      <p className="k-bubble-text" aria-live="polite">
        {/* A new line settles in (the live region itself stays put). */}
        <span key={text} className="k-bubble-line">
          {words.map((w, i) => {
            if (/^\s+$/.test(w) || !w) return w;
            wi++;
            return (
              <span key={i} className={active && sp.word === wi ? 'k-word on' : 'k-word'}>
                {w}
              </span>
            );
          })}
        </span>
      </p>
      {onSpeak && (
        <button type="button" className="k-speak" aria-label="Say it again" onClick={onSpeak}>
          <KidsIcon name="speaker" size={26} />
        </button>
      )}
    </div>
  );
}
