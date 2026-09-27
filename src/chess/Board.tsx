import { useCallback, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';
import type { Arrow, Mark, MarkColor } from '../content/types';
import { colorName, FILES } from './utils';
import { diffPieces, parsePlacement, type PieceState } from './pieces';
import { useSettings, type BoardTheme, type PieceSet } from '../store/profile';
import { sound } from './sound';

export type SquareTone = 'good' | 'bad' | 'hint' | 'focus';

/** A target square for the piece being moved. `move` is set for real chess moves. */
interface Dest {
  to: string;
  captured: boolean;
  promotion?: PieceSymbol;
  move?: Move;
}

export interface BoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  /** Whether the user can move pieces of the side to move. */
  interactive?: boolean;
  /** If set, only this color may be moved by the user. */
  playerColor?: Color;
  /** Called with the legal move the user made (from the board or a promotion choice). */
  onMove?: (move: Move) => void;
  lastMove?: [string, string] | null;
  arrows?: Arrow[];
  marks?: Mark[];
  tones?: Record<string, SquareTone>;
  onSquareClick?: (square: string) => void;
  coordinates?: boolean;
  /** Allow right-click arrows and circles. */
  drawable?: boolean;
  /**
   * Moves by custom rules, for positions chess.js cannot play (e.g. a lone knight collecting
   * stars in Kids mode): the target squares for each movable square, and a callback. When
   * set, it replaces the rules of chess; drag and click work as usual.
   */
  freeMoves?: { dests: Record<string, string[]>; onMove: (from: string, to: string) => void };
  /** Extra content drawn inside squares (e.g. stars to collect), keyed by square. */
  squareContent?: Record<string, ReactNode>;
  /** Override the learner's board theme / piece set (e.g. a Kids mode look). */
  boardTheme?: BoardTheme;
  pieceSet?: PieceSet;
  /** Force auto-queen (true) or the promotion picker (false); defaults to the learner's setting. */
  autoQueen?: boolean;
}

const ARROW_VAR: Record<MarkColor, string> = {
  green: 'var(--arrow-green)',
  red: 'var(--arrow-red)',
  blue: 'var(--arrow-blue)',
  yellow: 'var(--arrow-yellow)',
};

export function Board({
  fen,
  orientation = 'white',
  interactive = false,
  playerColor,
  onMove,
  lastMove,
  arrows,
  marks,
  tones,
  onSquareClick,
  coordinates,
  drawable = true,
  freeMoves,
  squareContent,
  boardTheme,
  pieceSet,
  autoQueen,
}: BoardProps) {
  const settings = useSettings();
  const showCoords = coordinates ?? settings.coordinates;
  const ref = useRef<HTMLDivElement>(null);
  const [pieces, setPieces] = useState<PieceState[]>(() => diffPieces([], parsePlacement(fen)));
  const moveHint = useRef<[string, string] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Drag state lives in a ref: pointer moves update the dragged piece's transform directly
  // instead of re-rendering the whole board. `dragging` only flips once the drag starts.
  // Positions are relative to the board, re-measured on every move so scrolling mid-drag is safe.
  const drag = useRef<{ from: string; startX: number; startY: number; x: number; y: number; size: number; moved: boolean; wasSelected: boolean } | null>(null);
  const dragEl = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [userShapes, setUserShapes] = useState<{ from: string; to?: string; color: MarkColor }[]>([]);
  const drawStart = useRef<string | null>(null);

  const flip = orientation === 'black';
  const xy = useCallback((sq: string) => {
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    return flip ? { x: 7 - f, y: r } : { x: f, y: 7 - r };
  }, [flip]);

  // Update pieces with stable identities when the position changes.
  useLayoutEffect(() => {
    setPieces((prev) => diffPieces(prev, parsePlacement(fen), moveHint.current ?? lastMove ?? null));
    moveHint.current = null;
    setSelected(null);
    setPromo(null);
    setUserShapes([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);

  const turn = chess?.turn() ?? 'w';
  const gameOver = useMemo(() => !chess || chess.isGameOver(), [chess]);
  const canMove = freeMoves ? interactive : interactive && !gameOver && (!playerColor || playerColor === turn);

  // Targets grouped by origin square: legal chess moves, or the custom free moves.
  const dests = useMemo(() => {
    const m = new Map<string, Dest[]>();
    if (!canMove) return m;
    if (freeMoves) {
      const occupied = new Set(parsePlacement(fen).map((p) => p.square));
      for (const [from, tos] of Object.entries(freeMoves.dests)) m.set(from, tos.map((to) => ({ to, captured: occupied.has(to) })));
      return m;
    }
    if (!chess) return m;
    for (const mv of chess.moves({ verbose: true })) {
      const list = m.get(mv.from) ?? [];
      list.push({ to: mv.to, captured: !!mv.captured, promotion: mv.promotion, move: mv });
      m.set(mv.from, list);
    }
    return m;
  }, [chess, canMove, freeMoves, fen]);

  const checkSquare = useMemo(() => {
    if (!chess || !chess.inCheck()) return null;
    return chess.findPiece({ type: 'k', color: chess.turn() })[0] ?? null;
  }, [chess]);

  const squareAt = (clientX: number, clientY: number): string | null => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return null;
    const x = Math.floor(((clientX - r.left) / r.width) * 8);
    const y = Math.floor(((clientY - r.top) / r.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    const f = flip ? 7 - x : x;
    const rank = flip ? y + 1 : 8 - y;
    return FILES[f] + rank;
  };

  const tryMove = (from: string, to: string) => {
    const opts = dests.get(from)?.filter((d) => d.to === to) ?? [];
    if (!opts.length) return false;
    if (opts[0].promotion) {
      if (autoQueen ?? settings.autoQueen) finishMove(from, to, 'q');
      else setPromo({ from, to });
      return true;
    }
    finishMove(from, to);
    return true;
  };

  const finishMove = (from: string, to: string, promotion?: PieceSymbol) => {
    const d = dests.get(from)?.find((x) => x.to === to && x.promotion === promotion);
    setSelected(null);
    setPromo(null);
    if (!d) return;
    moveHint.current = [from, to];
    if (d.move) onMove?.(d.move);
    else freeMoves?.onMove(from, to);
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (e.button === 2) {
      if (drawable) drawStart.current = sq;
      return;
    }
    if (e.button !== 0) return;
    if (userShapes.length) setUserShapes([]);
    if (promo) return;
    onSquareClick?.(sq);
    if (!canMove) return;
    // Complete a click-move.
    if (selected && selected !== sq && dests.get(selected)?.some((d) => d.to === sq)) {
      tryMove(selected, sq);
      return;
    }
    if (dests.has(sq)) {
      const r = ref.current!.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      drag.current = { from: sq, startX: x, startY: y, x, y, size: r.width, moved: false, wasSelected: selected === sq };
      setSelected(sq);
      ref.current!.setPointerCapture?.(e.pointerId);
    } else {
      setSelected(null);
    }
  };

  const dragTransform = (d: { x: number; y: number; size: number }) => `translate(${d.x - d.size / 16}px, ${d.y - d.size / 16}px) scale(1.08)`;

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const r = ref.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    d.size = r.width;
    // A drag starts once the pointer is a little way from where it went down.
    if (!d.moved && Math.hypot(x - d.startX, y - d.startY) > r.width / 40) {
      d.moved = true;
      setDragging(d.from);
    }
    d.x = x;
    d.y = y;
    if (dragEl.current) dragEl.current.style.transform = dragTransform(d);
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(null);
  };

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button === 2 && drawable && drawStart.current) {
      const end = squareAt(e.clientX, e.clientY);
      const start = drawStart.current;
      drawStart.current = null;
      if (!end) return;
      const color: MarkColor = e.shiftKey ? 'red' : e.altKey ? 'blue' : e.ctrlKey || e.metaKey ? 'yellow' : 'green';
      setUserShapes((shapes) => {
        const same = (s: { from: string; to?: string }) => s.from === start && (s.to ?? start) === end;
        if (shapes.some(same)) return shapes.filter((s) => !same(s));
        return [...shapes, end === start ? { from: start, color } : { from: start, to: end, color }];
      });
      return;
    }
    const d = drag.current;
    if (!d) return;
    endDrag();
    const sq = squareAt(e.clientX, e.clientY);
    if (!d.moved) {
      // A click: select, or deselect when clicking the selected piece again.
      if (d.wasSelected) setSelected(null);
      return;
    }
    if (sq && sq !== d.from && tryMove(d.from, sq)) return;
    if (sq !== d.from) setSelected(null);
  };

  const squares = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const f = flip ? 7 - x : x;
      const rank = flip ? y + 1 : 8 - y;
      const sq = FILES[f] + rank;
      const light = (f + rank) % 2 === 0; // a1 (f=0, rank=1) is a dark square
      const cls = ['sq', light ? 'light' : 'dark'];
      if (lastMove && (lastMove[0] === sq || lastMove[1] === sq)) cls.push('last');
      if (selected === sq) cls.push('selected');
      if (checkSquare === sq) cls.push('check');
      const tone = tones?.[sq];
      if (tone) cls.push(`tone-${tone}`);
      const dest = selected ? dests.get(selected)?.find((d) => d.to === sq) : undefined;
      squares.push(
        <div key={sq} className={cls.join(' ')} data-square={sq}>
          {dest && <span className={dest.captured ? 'dest capture' : 'dest'} />}
          {squareContent?.[sq]}
          {showCoords && x === 0 && <span className="coord rank">{rank}</span>}
          {showCoords && y === 7 && <span className="coord file">{FILES[f]}</span>}
        </div>,
      );
    }
  }

  const allShapes = [
    ...(arrows ?? []).map((a) => ({ from: a.from, to: a.to, color: a.color ?? 'green' })),
    ...(marks ?? []).map((m) => ({ from: m.square, to: undefined, color: m.color ?? 'green' })),
    ...userShapes,
  ];

  const promoSquares = promo
    ? (['q', 'n', 'r', 'b'] as PieceSymbol[]).map((p, i) => {
        const { x, y } = xy(promo.to);
        const dir = y === 0 ? 1 : -1;
        return { p, x, y: y + dir * i };
      })
    : [];

  return (
    <div
      ref={ref}
      className={`board board-${boardTheme ?? settings.boardTheme} pieces-${pieceSet ?? settings.pieceSet}${canMove ? ' can-move' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endDrag}
      onContextMenu={(e) => e.preventDefault()}
      role="img"
      aria-label={`Chess board, ${colorName(turn)} to move`}
    >
      <div className="squares">{squares}</div>
      {pieces.map((p) => {
        const { x, y } = xy(p.square);
        const isDragged = dragging === p.square && drag.current;
        return (
          <div
            key={p.id}
            ref={isDragged ? dragEl : undefined}
            className={`piece pc-${p.color}${p.type.toUpperCase()}${isDragged ? ' dragging' : ''}`}
            style={{ transform: isDragged ? dragTransform(drag.current!) : `translate(${x * 100}%, ${y * 100}%)` }}
          />
        );
      })}
      {allShapes.length > 0 && (
        <svg className="shapes" viewBox="0 0 8 8" aria-hidden="true">
          <defs>
            {(['green', 'red', 'blue', 'yellow'] as MarkColor[]).map((c) => (
              <marker key={c} id={`ah-${c}`} markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 V4 L3,2 Z" fill={ARROW_VAR[c]} />
              </marker>
            ))}
          </defs>
          {allShapes.map((s, i) => {
            const a = xy(s.from);
            if (!s.to || s.to === s.from) {
              return <circle key={i} cx={a.x + 0.5} cy={a.y + 0.5} r={0.44} fill="none" stroke={ARROW_VAR[s.color]} strokeWidth={0.07} opacity={0.85} />;
            }
            const b = xy(s.to);
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy);
            const shorten = 0.36;
            const x2 = a.x + 0.5 + dx * ((len - shorten) / len);
            const y2 = a.y + 0.5 + dy * ((len - shorten) / len);
            return (
              <line
                key={i}
                x1={a.x + 0.5}
                y1={a.y + 0.5}
                x2={x2}
                y2={y2}
                stroke={ARROW_VAR[s.color]}
                strokeWidth={0.16}
                strokeLinecap="round"
                markerEnd={`url(#ah-${s.color})`}
                opacity={0.82}
              />
            );
          })}
        </svg>
      )}
      {promo && (
        <div className="promo" onPointerDown={(e) => e.stopPropagation()}>
          {promoSquares.map(({ p, x, y }) => (
            <button
              key={p}
              type="button"
              className={`promo-choice pc-${turn}${p.toUpperCase()}`}
              style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%` }}
              aria-label={`Promote to ${{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight', k: '', p: '' }[p]}`}
              onClick={() => finishMove(promo.from, promo.to, p)}
            />
          ))}
          <button type="button" className="promo-cancel" aria-label="Cancel promotion" onClick={() => setPromo(null)} />
        </div>
      )}
    </div>
  );
}

/** Plays the standard move sound for a SAN move. */
export function playMoveSound(san: string | undefined) {
  if (!san) return;
  if (san.includes('#')) sound('mate');
  else if (san.includes('+')) sound('check');
  else if (san.includes('x')) sound('capture');
  else if (san.startsWith('O-O')) sound('castle');
  else sound('move');
}
