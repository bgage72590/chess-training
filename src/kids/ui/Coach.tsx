// Pip plus his speech bubble. A row in portrait, a column in landscape (CSS). This is the Pip that
// reacts to pipReact() events, and his mouth opens on each spoken word.
import { Pip, type PipMood } from './Pip';
import { SpeechBubble } from './SpeechBubble';
import { useSpeech } from '../player/speech';

export function Coach({ text, mood = 'idle', token, onSpeak, size = 72 }: { text: string; mood?: PipMood; token?: number; onSpeak?: () => void; size?: number }) {
  const sp = useSpeech();
  const talking = sp.speaking && token != null && sp.token === token;
  const m: PipMood = talking && (mood === 'idle' || mood === 'talk') ? 'talk' : mood === 'talk' ? 'idle' : mood;
  return (
    <div className="k-coach">
      <Pip mood={m} size={size} className="k-coach-pip" listen talkWord={talking ? sp.word : undefined} />
      {text && <SpeechBubble text={text} token={token} onSpeak={onSpeak} />}
    </div>
  );
}
