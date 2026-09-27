// Pip's speech bubble: big friendly text with karaoke highlighting and a speaker button.
import { useSpeech } from '../player/speech';
import { KidsIcon } from './KidsIcon';

export function SpeechBubble({ text, token, onSpeak, tail = 'left' }: { text: string; token?: number; onSpeak?: () => void; tail?: 'left' | 'top' | 'none' }) {
  const sp = useSpeech();
  const active = token != null && sp.token === token && sp.word >= 0;
  const words = text.split(/(\s+)/);
  let wi = -1;
  return (
    <div className={`k-bubble tail-${tail}`}>
      <p className="k-bubble-text" aria-live="polite">
        {words.map((w, i) => {
          if (/^\s+$/.test(w) || !w) return w;
          wi++;
          return (
            <span key={i} className={active && sp.word === wi ? 'k-word on' : 'k-word'}>
              {w}
            </span>
          );
        })}
      </p>
      {onSpeak && (
        <button type="button" className="k-speak" aria-label="Say it again" onClick={onSpeak}>
          <KidsIcon name="speaker" size={26} />
        </button>
      )}
    </div>
  );
}
