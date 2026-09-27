// Confetti: 40 CSS particles (stars, tiny crowns, pawns) for bosses, worlds and graduation only.
// Removed after 1.4 s; a static burst under reduced motion (handled in CSS).
import { useEffect, useMemo, useState } from 'react';

const COLORS = ['#ffc83d', '#ff9f7f', '#9ad48f', '#7ab0e0', '#c9b3ff', '#f4a3c1'];
const SHAPES = ['star', 'crown', 'pawn', 'dot'];

export function Confetti({ run }: { run: number }) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!run) return;
    setLive(true);
    const t = setTimeout(() => setLive(false), 1500);
    return () => clearTimeout(t);
  }, [run]);
  const bits = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        color: COLORS[i % COLORS.length],
        shape: SHAPES[i % SHAPES.length],
        x: Math.round(Math.random() * 100),
        angle: Math.round(Math.random() * 720 - 360),
        delay: Math.round(Math.random() * 250),
        drift: Math.round(Math.random() * 30 - 15),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run],
  );
  if (!live) return null;
  return (
    <div className="k-confetti" aria-hidden="true">
      <span className="k-burst" />
      {bits.map((b, i) => (
        <i
          key={i}
          className={`k-conf ${b.shape}`}
          style={{ left: `${b.x}%`, ['--c' as string]: b.color, ['--a' as string]: `${b.angle}deg`, ['--d' as string]: `${b.delay}ms`, ['--dx' as string]: `${b.drift}vw` }}
        />
      ))}
    </div>
  );
}
