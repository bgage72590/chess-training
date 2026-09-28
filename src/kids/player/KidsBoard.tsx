// KidsBoard: the real Board in a wooden toy frame, with meadow squares, square art, play areas
// (clouds), kid-size dots, one-tap moves for a lone piece, tap-only mode, a keyboard cursor and
// a big promotion picker. Uses only Board's public props (plus autoQueen). Spec 11.5 and 10.2.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Chess, type Move } from 'chess.js';
import { Board, type SquareTone } from '../../chess/Board';
import type { Arrow, ArtKey, HintStep, Sq } from '../activities/types';
import { SquareArt } from '../ui/SquareArt';
import { sqRange, ALL_SQUARES } from '../lib/miniRules';
import { resolvePieceSet } from '../lib/pieceProbe';
import { useKidCtx } from './context';
import { KidsPromoPicker } from './KidsPromoPicker';
import { kidSound } from '../lib/kidsSound';
import { playableDests } from '../lib/chessDests';
import { useBoardFx } from '../activities/useBoardFx';
import '../motion-board.css';

const FILES = 'abcdefgh';

export interface KidsBoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  interactive?: boolean;
  playerColor?: 'w' | 'b';
  onMove?: (m: Move) => void;
  freeMoves?: { dests: Record<Sq, Sq[]>; onMove: (from: Sq, to: Sq) => void };
  onSquareClick?: (sq: Sq) => void;
  /** A tap on a square the selected piece cannot reach (never a mistake; the activity decides). */
  onMiss?: (sq: Sq, from: Sq) => void;
  lastMove?: [Sq, Sq] | null;
  area?: string;
  art?: Partial<Record<Sq, ArtKey | ArtKey[]>>;
  /** Free-form extra content per square (e.g. a star pop). */
  overlay?: Partial<Record<Sq, ReactNode>>;
  tones?: Partial<Record<Sq, SquareTone>>;
  arrows?: Arrow[];
  /** The current hint step: its tones, arrows and art are drawn too. */
  hint?: HintStep | null;
  wobble?: Sq | null;
  /** Move dots: on/off, or per moving piece (its from-square). Dots never sit on lava. */
  showDests?: boolean | ((from: Sq) => boolean);
  promotion?: 'auto' | 'picker';
  coordinates?: boolean;
  label?: string;
}

const toSq = (f: number, r: number) => FILES[f] + (r + 1);

export function KidsBoard(props: KidsBoardProps) {
  const { fen, orientation = 'white', interactive = true, playerColor, freeMoves, area } = props;
  const { kid, band, tuning, reducedMotion } = useKidCtx();
  const wrap = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Sq | null>(null);
  const [cursor, setCursor] = useState<Sq | null>(null);
  const [kbdFrom, setKbdFrom] = useState<Sq | null>(null);
  const [promo, setPromo] = useState<{ from: Sq; to: Sq } | null>(null);
  const tapOnly = kid?.settings.tapOnly ?? tuning.tapOnly;
  const areaSet = useMemo(() => (area ? sqRange(area) : null), [area]);
  const pieceSet = useMemo(() => resolvePieceSet(kid?.settings.pieceSet ?? 'auto'), [kid?.settings.pieceSet]);
  const coords = props.coordinates ?? kid?.settings.coordinates ?? tuning.coordinates;

  // Selection resets whenever the position changes.
  useEffect(() => {
    setSel(null);
    setKbdFrom(null);
    setPromo(null);
  }, [fen]);

  const chess = useMemo(() => {
    if (freeMoves) return null;
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen, freeMoves]);

  // Targets per square (free moves filtered to the area, or legal chess moves for the player).
  const dests = useMemo(() => {
    const out: Record<Sq, Sq[]> = {};
    if (!interactive) return out;
    if (freeMoves) {
      for (const [from, tos] of Object.entries(freeMoves.dests)) {
        const t = areaSet ? tos.filter((x) => areaSet.has(x)) : tos;
        if (t.length) out[from] = t;
      }
      return out;
    }
    return playableDests(fen, playerColor);
  }, [interactive, freeMoves, areaSet, fen, playerColor]);

  const movable = Object.keys(dests);
  const lone = !!freeMoves && tuning.autoSelectLone && movable.length === 1 ? movable[0] : null;
  const active = kbdFrom ?? sel ?? lone;
  const showDests = typeof props.showDests === 'function' ? !!active && props.showDests(active) : props.showDests ?? true;
  useBoardFx(wrap, { reduced: reducedMotion, orientation, fen, from: active, lift: kbdFrom ?? sel });
  /** Where the current press went down (tap-only: a drag-and-release still makes the move). */
  const downSq = useRef<Sq | null>(null);


  const doMove = useCallback(
    (from: Sq, to: Sq) => {
      if (freeMoves) {
        freeMoves.onMove(from, to);
        return;
      }
      if (!chess) return;
      const legal = chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to);
      if (!legal.length) return;
      if (legal[0].promotion && (props.promotion ?? tuning.promotion) === 'picker') {
        setPromo({ from, to });
        return;
      }
      const m = new Chess(fen).move({ from, to, promotion: legal[0].promotion ? 'q' : undefined });
      props.onMove?.(m);
    },
    [freeMoves, chess, fen, props, tuning.promotion],
  );

  // Board always gets free moves: chess.js activities pass their legal moves through here, so
  // positions Board would call "game over" (e.g. K+N v K) stay playable and promotions use the big picker.
  const boardFree = useMemo(() => ({ dests, onMove: (from: Sq, to: Sq) => doMove(from, to) }), [dests, doMove]);

  const squareFromPoint = (x: number, y: number): Sq | null => {
    const b = wrap.current?.querySelector('.board')?.getBoundingClientRect();
    if (!b) return null;
    const fx = Math.floor(((x - b.left) / b.width) * 8);
    const fy = Math.floor(((y - b.top) / b.height) * 8);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    return orientation === 'black' ? toSq(7 - fx, fy) : toSq(fx, 7 - fy);
  };

  // Runs before Board sees the press: area filtering, one-tap moves, selection tracking, misses.
  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || promo) return;
    const sq = squareFromPoint(e.clientX, e.clientY);
    downSq.current = null;
    if (!sq) return;
    setKbdFrom(null);
    if (areaSet && !areaSet.has(sq)) {
      e.stopPropagation();
      return;
    }
    if (!interactive) return;
    if (lone && !sel && dests[lone]?.includes(sq)) {
      // One-tap move for a lone piece (Board never sees this press).
      e.stopPropagation();
      props.onSquareClick?.(sq);
      doMove(lone, sq);
      return;
    }
    if (dests[sq]) {
      downSq.current = sq;
      setSel((s) => (s === sq ? null : sq));
      return;
    }
    const from = sel ?? lone;
    if (from && !dests[from]?.includes(sq)) props.onMiss?.(sq, from);
    setSel(null);
  };

  // Tap-only mode absorbs drags (little fingers wobble), but a real drag from a piece onto one of its
  // squares still counts: the release finishes the move like a second tap.
  const onPointerUpCapture = (e: PointerEvent<HTMLDivElement>) => {
    const from = downSq.current;
    downSq.current = null;
    if (!tapOnly || !from || !interactive || promo || e.button !== 0) return;
    const to = squareFromPoint(e.clientX, e.clientY);
    if (!to || to === from || (areaSet && !areaSet.has(to))) return;
    if (dests[from]?.includes(to)) {
      setSel(null);
      props.onSquareClick?.(to);
      doMove(from, to);
    } else props.onMiss?.(to, from);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dirs: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const cur = cursor ?? active ?? (orientation === 'black' ? 'h8' : 'a1');
    if (dirs[e.key]) {
      e.preventDefault();
      let [dx, dy] = dirs[e.key];
      if (orientation === 'black') [dx, dy] = [-dx, -dy];
      const f = Math.min(7, Math.max(0, FILES.indexOf(cur[0]) + dx));
      const r = Math.min(7, Math.max(0, Number(cur[1]) - 1 + dy));
      setCursor(toSq(f, r));
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const sq = cursor ?? cur;
    if (areaSet && !areaSet.has(sq)) return;
    const from = kbdFrom ?? sel ?? lone;
    if (from && dests[from]?.includes(sq)) {
      setKbdFrom(null);
      props.onSquareClick?.(sq);
      doMove(from, sq);
    } else if (dests[sq]) {
      setKbdFrom(sq === kbdFrom ? null : sq);
      props.onSquareClick?.(sq);
    } else {
      if (from) props.onMiss?.(sq, from);
      setKbdFrom(null);
      props.onSquareClick?.(sq);
    }
  };

  // Wobble a piece: find the piece element on that square and shake it (CSS `translate`).
  useEffect(() => {
    const sq = props.wobble;
    if (!sq || !wrap.current) return;
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    const x = orientation === 'black' ? 7 - f : f;
    const y = orientation === 'black' ? r : 7 - r;
    const el = [...wrap.current.querySelectorAll<HTMLElement>('.piece')].find((p) => p.style.transform.replace(/\s/g, '') === `translate(${x * 100}%,${y * 100}%)`);
    const target = el ?? wrap.current.querySelector<HTMLElement>(`[data-square="${sq}"]`);
    target?.classList.add('k-wobble');
    const t = setTimeout(() => target?.classList.remove('k-wobble'), 320);
    return () => {
      clearTimeout(t);
      target?.classList.remove('k-wobble');
    };
  }, [props.wobble, orientation]);

  // Merge every art layer into one squareContent map.
  const content = useMemo(() => {
    const layers = new Map<Sq, ArtKey[]>();
    const add = (sq: Sq, a: ArtKey | ArtKey[] | undefined) => {
      if (!a) return;
      const arr = layers.get(sq) ?? [];
      arr.push(...(Array.isArray(a) ? a : [a]));
      layers.set(sq, arr);
    };
    for (const [sq, a] of Object.entries(props.art ?? {})) add(sq, a);
    for (const [sq, a] of Object.entries(props.hint?.art ?? {})) add(sq, a);
    if (areaSet) for (const sq of ALL_SQUARES) if (!areaSet.has(sq)) add(sq, 'cloud');
    const tones = { ...(props.tones ?? {}), ...(props.hint?.tones ?? {}) };
    for (const [sq, t] of Object.entries(tones)) if (t === 'good') add(sq, 'check');
    // Kid-size dots for the auto-selected, tracked or keyboard piece (Board draws its own for drags).
    if (showDests && active && (lone === active || kbdFrom === active))
      for (const d of dests[active] ?? []) if (!layers.get(d)?.includes('dot') && !layers.get(d)?.includes('lava')) add(d, 'dot');
    const out: Record<Sq, ReactNode> = {};
    for (const sq of new Set([...layers.keys(), ...Object.keys(props.overlay ?? {}), ...(cursor ? [cursor] : [])])) {
      out[sq] = (
        <>
          {(layers.get(sq) ?? []).map((a, i) => (
            <SquareArt key={i} art={a} />
          ))}
          {props.overlay?.[sq]}
          {cursor === sq && <span className="k-cursor" />}
        </>
      );
    }
    return out;
  }, [props.art, props.hint, props.tones, props.overlay, areaSet, showDests, active, lone, kbdFrom, dests, cursor]);

  const tones = useMemo(() => ({ ...(props.tones ?? {}), ...(props.hint?.tones ?? {}) }) as Record<string, SquareTone>, [props.tones, props.hint]);
  const arrows = useMemo(() => [...(props.arrows ?? []), ...(props.hint?.arrows ?? [])], [props.arrows, props.hint]);
  const turn = (fen.split(' ')[1] ?? 'w') as 'w' | 'b';

  return (
    <div
      ref={wrap}
      className={`kids-board${tapOnly ? ' tap-only' : ''}${showDests ? '' : ' no-dests'}${band === 'sprout' ? ' sprout' : ''}`}
      tabIndex={0}
      role="group"
      aria-label={props.label ?? 'Chess board. Use the arrow keys and Enter to move.'}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={(e) => {
        if (tapOnly) e.stopPropagation();
      }}
      onPointerUpCapture={onPointerUpCapture}
      onKeyDown={onKeyDown}
      onBlur={() => setCursor(null)}
    >
      <Board
        fen={fen}
        orientation={orientation}
        interactive={interactive && !promo}
        playerColor={playerColor}
        freeMoves={boardFree}
        lastMove={props.lastMove ?? null}
        arrows={arrows}
        tones={tones}
        onSquareClick={(sq) => {
          if (areaSet && !areaSet.has(sq)) return;
          props.onSquareClick?.(sq);
        }}
        coordinates={coords}
        drawable={false}
        squareContent={content}
        boardTheme="tourney"
        pieceSet={pieceSet}
        autoQueen={true}
      />
      {promo && (
        <KidsPromoPicker
          color={turn}
          speak={band !== 'champion' && kid?.settings.voice !== 'off' && !kid?.settings.muted}
          onCancel={() => setPromo(null)}
          onPick={(p) => {
            const pr = promo;
            setPromo(null);
            try {
              const m = new Chess(fen).move({ from: pr.from, to: pr.to, promotion: p });
              kidSound('sparkle');
              props.onMove?.(m);
            } catch {
              /* illegal: ignore */
            }
          }}
        />
      )}
    </div>
  );
}

/** Bounce-back helper: show the wrong move, wobble, then hop back (450 ms). The caller's
 *  player.mistake() plays the soft boop. */
export function useBounce() {
  const [shown, setShown] = useState<{ fen: string; lastMove: [Sq, Sq]; wobble: Sq | null } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const bounce = useCallback((before: string, after: string, move: [Sq, Sq], onDone?: () => void) => {
    timers.current.forEach(clearTimeout);
    const [from, to] = move;
    setShown({ fen: after, lastMove: [from, to], wobble: null });
    timers.current = [
      setTimeout(() => setShown({ fen: after, lastMove: [from, to], wobble: to }), 200),
      setTimeout(() => setShown({ fen: before, lastMove: [to, from], wobble: null }), 450),
      setTimeout(() => {
        setShown(null);
        onDone?.();
      }, 750),
    ];
  }, []);
  return { shown, bounce, bouncing: !!shown };
}
