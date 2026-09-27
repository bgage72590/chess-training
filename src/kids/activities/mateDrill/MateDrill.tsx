// Checkmate drills: K+2R, K+Q or K+R against a lone king. The king defends with the engine when
// it is ready (depth 12, 2 s budget), else with the JS defender. Stalemates and loose pieces
// hop back for a gentle retry. Helpers: ladder rungs, the queen's shrinking box, a move counter.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Chess, type Move } from 'chess.js';
import type { ActivityProps, HintStep, Sq, SquareTone } from '../types';
import { standardScore } from '../types';
import { KidsBoard, useBounce } from '../../player/KidsBoard';
import { fenPlacement } from '../../lib/fen';
import { engine } from '../../../engine/engine';
import { defend } from './defense';
import { drillScore, greedyWhiteMove, judgeKidMove, ladderRungs, queenBox, type MateDrillItem } from './logic';
import './mateDrill.css';

const NAME: Record<string, string> = { q: 'queen', r: 'rook', k: 'king' };
const ENGINE_BUDGET_MS = 2000;

const uci = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '');

function playUci(fen: string, u: string): { fen: string; move: Move } | null {
  try {
    const c = new Chess(fen);
    const move = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    return { fen: c.fen(), move };
  } catch {
    return null;
  }
}

/** The engine's move within the budget, or null (not ready, failed, slow, or illegal). */
async function engineMove(fen: string, depth: number): Promise<string | null> {
  if (engine.status !== 'ready') return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<'slow'>((res) => (timer = setTimeout(() => res('slow'), ENGINE_BUDGET_MS)));
  try {
    const r = await Promise.race([engine.search(fen, { depth }), slow]);
    if (r === 'slow') {
      engine.cancelAll();
      return null;
    }
    return r?.best && playUci(fen, r.best) ? r.best : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The defending king's reply: engine first, JS fallback. */
async function defenderMove(fen: string): Promise<string | null> {
  const e = await engineMove(fen, 12);
  if (e) return e;
  const m = defend(fen);
  return m ? uci(m) : null;
}

export function MateDrill({ item, player, onDone }: ActivityProps<MateDrillItem>) {
  const [fen, setFen] = useState(item.fen);
  const [lastMove, setLastMove] = useState<[Sq, Sq] | null>(null);
  const [moves, setMoves] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [watching, setWatching] = useState(false);
  const [flash, setFlash] = useState<Partial<Record<Sq, SquareTone>>>({});
  const { shown, bounce, bouncing } = useBounce();
  const alive = useRef(true);
  const seen = useRef(new Set<string>());
  const remember = (f: string) => seen.current.add(f.split(' ').slice(0, 2).join(' '));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const wait = (ms: number) => new Promise<void>((res) => later(res, ms));
  useEffect(() => {
    // Warm the engine up for the next positions; the JS defender covers until (or unless) it is ready.
    if (engine.status === 'idle') engine.init().catch(() => undefined);
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
      if (engine.status === 'ready') engine.cancelAll();
    };
  }, []);

  // Hints: the rule, then Pip's suggested move (greedy JS: mate, else squeeze without stalemate).
  const suggestion = useMemo(() => (busy || done ? null : greedyWhiteMove(fen, seen.current)), [fen, busy, done]);
  useEffect(() => {
    const rule =
      item.method === 'ladder'
        ? 'One rook guards a row, the other gives check. Then swap!'
        : item.method === 'box'
          ? 'Keep the king in the box and make it smaller. Bring your king to help!'
          : 'Use the rook to fence the king in, and walk your king closer.';
    const s = suggestion;
    const steps: HintStep[] = [
      { say: rule },
      s ? { say: `Try the ${NAME[s.piece]}!`, tones: { [s.from]: 'hint' } } : {},
      s ? { say: 'Follow the arrow!', tones: { [s.from]: 'hint' }, arrows: [{ from: s.from, to: s.to, color: 'green' }] } : {},
      s ? { say: 'This move! Tap it.', tones: { [s.from]: 'hint', [s.to]: 'hint' }, arrows: [{ from: s.from, to: s.to, color: 'green' }] } : {},
    ];
    player.setHints(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion]);

  const finish = (n: number) => {
    setDone(true);
    player.sound('fanfare');
    player.celebrate('checkmate');
    player.award('st-first-mate');
    if (item.method === 'ladder') {
      player.award('st-ladder-mate');
      player.best('ladder-moves', n, 'lower');
    }
    if (item.method === 'box') player.award('tr-box');
    player.say({ all: `Checkmate in ${n} moves! Amazing!`, champion: `Checkmate in ${n} moves.` }, 'cheer');
    const hl = player.hintLevel;
    const score = watching ? 1 : (Math.min(drillScore(n, item.maxMoves), standardScore(mistakes, hl)) as 1 | 2 | 3);
    later(() => onDone({ score, mistakes, hintLevel: hl, stats: { moves: n, maxMoves: item.maxMoves } }), 1800);
  };

  // The king thinks, then replies.
  const reply = async (after: string) => {
    setBusy(true);
    const [u] = await Promise.all([defenderMove(after), wait(450)]);
    if (!alive.current) return;
    const r = u ? playUci(after, u) : null;
    if (r) {
      setFen(r.fen);
      setLastMove([r.move.from, r.move.to]);
      player.sound('move');
    }
    setBusy(false);
  };

  const onMove = (m: Move) => {
    if (busy || bouncing || done || watching) return;
    const j = judgeKidMove(fen, m);
    if (!j) return;
    if (j.verdict === 'stalemate' || j.verdict === 'blunder') {
      setMistakes((x) => x + 1);
      bounce(fen, j.fen, [m.from, m.to]);
      if (j.verdict === 'stalemate') player.mistake({ all: "Oops, it's a tie: the king had no moves but wasn't in check! Try another move.", champion: 'That is stalemate. Try again.' });
      else {
        const lost = j.lost!;
        const pc = fenPlacement(fen)[lost === m.to ? m.from : lost];
        player.mistake({ all: `Careful! The king could gobble your ${NAME[pc?.toLowerCase() ?? 'r'] ?? 'piece'}. Try again!`, champion: 'That piece would hang. Try again.' });
        setFlash({ [lost]: 'bad' });
        later(() => setFlash({}), 1400);
      }
      return;
    }
    const n = moves + 1;
    setMoves(n);
    remember(j.fen);
    setFen(j.fen);
    setLastMove([m.from, m.to]);
    if (j.verdict === 'mate') return finish(n);
    player.sound(new Chess(j.fen).inCheck() ? 'check' : 'move');
    if (item.method === 'box' && n > 1) {
      const before = queenBox(fen).length;
      const now = queenBox(j.fen).length;
      if (now && before && now < before) player.say({ all: 'The box got smaller!', champion: 'Smaller box.' }, 'cheer');
    }
    void reply(j.fen);
  };

  // After twice the target, Pip offers to finish the mate.
  const tooLong = moves >= item.maxMoves * 2 && !done && !watching;
  const watch = async () => {
    setWatching(true);
    player.say({ all: 'Watch me finish it!', champion: 'Watch the finish.' });
    let cur = fen;
    let n = moves;
    for (let i = 0; i < 60 && alive.current; i++) {
      await wait(700);
      const g = greedyWhiteMove(cur, seen.current);
      const w = (await engineMove(cur, 12)) ?? (g ? uci(g) : null);
      const r = w ? playUci(cur, w) : null;
      if (!r || !alive.current) break;
      cur = r.fen;
      remember(cur);
      n += 1;
      setFen(cur);
      setLastMove([r.move.from, r.move.to]);
      player.sound('move');
      const c = new Chess(cur);
      if (c.isCheckmate() || c.isGameOver()) break;
      await wait(600);
      const b = await defenderMove(cur);
      const rb = b ? playUci(cur, b) : null;
      if (!rb || !alive.current) break;
      cur = rb.fen;
      setFen(cur);
      setLastMove([rb.move.from, rb.move.to]);
    }
    if (!alive.current) return;
    setDone(true);
    const hl = player.hintLevel;
    player.say({ all: 'There! Next time you can do it all by yourself!', champion: 'Done. Try it yourself next time.' });
    later(() => onDone({ score: 1, mistakes, hintLevel: hl, stats: { moves: n, maxMoves: item.maxMoves } }), 1600);
  };
  useEffect(() => {
    player.setTray(tooLong ? [{ id: 'watch', label: 'Watch Pip finish', icon: 'eye', variant: 'info', onPress: () => void watch() }] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tooLong]);
  useEffect(() => () => player.setTray(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers drawn on the board.
  const overlay: Partial<Record<Sq, ReactNode>> = {};
  const helper = item.method === 'box' ? queenBox(fen) : item.method === 'ladder' ? ladderRungs(fen) : [];
  const cls = item.method === 'box' ? 'k-matedrill-box' : 'k-matedrill-rung';
  for (const s of helper) overlay[s] = <span className={cls} aria-hidden="true" />;

  const boardFen = shown?.fen ?? fen;
  return (
    <div className="k-matedrill">
      <KidsBoard
        fen={boardFen}
        interactive={!busy && !bouncing && !done && !watching}
        playerColor="w"
        onMove={onMove}
        lastMove={shown?.lastMove ?? lastMove}
        wobble={shown?.wobble ?? null}
        tones={flash}
        overlay={overlay}
        hint={done || watching ? null : player.hint}
        showDests={true}
        label={`Checkmate drill: move ${moves} of ${item.maxMoves}`}
      />
      <div className="k-matedrill-count" aria-live="polite">
        {moves} / {item.maxMoves}
      </div>
    </div>
  );
}
