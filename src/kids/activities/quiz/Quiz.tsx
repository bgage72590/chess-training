// What's Happening? Quiz: a still board plus big picture answers in the Tray. A wrong answer is a
// mistake and Pip explains it with an arrow or a glow; the kid then picks again. `move` items
// embed the framework's Find the Move. Spec 13.9.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActivityProps, Arrow, ArtKey, BandText, HintStep, ItemMeta, PieceCode, Sq, SquareTone, TrayButton } from '../types';
import { standardScore } from '../types';
import { KidsBoard } from '../../player/KidsBoard';
import { FindMove } from '../findMove';
import type { FindMoveItem } from '../findMove/logic';
import { dests } from '../../lib/miniRules';
import { fenPlacement, placementFen } from '../../lib/fen';
import { KidsIcon, type KidsIconName } from '../../ui/KidsIcon';
import { BalanceScale } from './BalanceScale';
import { CANDY, PIECE_NAME, castleReasons, checkers, countOptions, isLight, kingSquare, munchers, statusOf, tradeOutcome, valueAnswer, type CastleReason, type QuizItem } from './logic';
import './quiz.css';

type Props = ActivityProps<QuizItem>;

export function Quiz(props: Props) {
  const { item } = props;
  if (item.kind === 'move') {
    const inner = { ...item.move, id: item.id, say: item.say, rule: item.rule } as FindMoveItem & ItemMeta;
    return <FindMove {...(props as unknown as ActivityProps<FindMoveItem>)} item={inner} />;
  }
  return <QuizCard {...props} />;
}

interface Option {
  id: string;
  label: BandText;
  icon?: KidsIconName;
  art?: ReactNode;
}

type Phase = 'ask' | 'attacker' | 'reason' | 'munch' | 'show' | 'done';

const REASONS: { id: CastleReason; label: string; icon: KidsIconName; say: string }[] = [
  { id: 'king-moved', label: 'King walked', icon: 'road', say: 'The king already walked, so he can never castle again.' },
  { id: 'rook-moved', label: 'Rook walked', icon: 'road', say: 'That rook already moved, so it cannot castle.' },
  { id: 'in-the-way', label: 'In the way', icon: 'rock', say: 'A piece is standing in the way. The path must be empty.' },
  { id: 'in-check', label: 'In check', icon: 'flame', say: 'You can never castle out of check.' },
  { id: 'path-attacked', label: 'Path in danger', icon: 'eye', say: 'The king would walk through an attacked square. Not allowed!' },
];

const other = (c: 'w' | 'b') => (c === 'w' ? 'b' : 'w');

function QuizCard({ item, player, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>(item.kind === 'munch' ? 'munch' : 'ask');
  const [wrong, setWrong] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [picked, setPicked] = useState<Sq[]>([]);
  const [shownFen, setShownFen] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<[Sq, Sq] | null>(null);
  const [scale, setScale] = useState<{ gain: number; loss: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const mistakesRef = useRef(0);
  const band = player.band;

  // ---------- the board ----------
  const baseFen = useMemo(() => {
    switch (item.kind) {
      case 'count':
      case 'bishop-reach':
        return placementFen(item.pieces);
      case 'value':
        return placementFen({ c4: item.a.toUpperCase() as PieceCode, f4: item.b.toUpperCase() as PieceCode });
      default:
        return 'fen' in item ? item.fen : '8/8/8/8/8/8/8/8 w - - 0 1';
    }
  }, [item]);

  const fen = shownFen ?? baseFen;
  const king = 'fen' in item ? kingSquare(item.fen) : null;
  const attackers = useMemo(() => ('fen' in item && item.kind !== 'trade' && item.kind !== 'munch' ? checkers(item.fen) : []), [item]);
  const countDests = useMemo(() => {
    if (item.kind !== 'count') return [];
    const [from, piece] = Object.entries(item.pieces)[0];
    return dests(piece!, from, { blocked: new Set() });
  }, [item]);
  const bishopSq = item.kind === 'bishop-reach' ? Object.keys(item.pieces)[0] : null;

  // ---------- answers ----------
  const [countOpts] = useState(() => (item.kind === 'count' ? countOptions(item.answer, () => player.rng()) : []));
  const { options, correct } = useMemo((): { options: Option[]; correct: string } => {
    const yesNo = (answer: boolean, yes: BandText = { all: 'Yes!', champion: 'Yes' }, no: BandText = { all: 'No!', champion: 'No' }) => ({
      options: [
        { id: 'yes', label: yes, icon: 'check' as KidsIconName },
        { id: 'no', label: no, icon: 'x' as KidsIconName },
      ],
      correct: answer ? 'yes' : 'no',
    });
    switch (item.kind) {
      case 'status2':
        return {
          options: [
            { id: 'check', label: { all: 'Check!', sprout: 'Yes!' }, art: <KingFace mood="scared" /> },
            { id: 'nothing', label: { all: 'All calm', sprout: 'No' }, art: <KingFace mood="calm" /> },
          ],
          correct: item.answer,
        };
      case 'status4':
        return {
          options: [
            { id: 'check', label: 'Check', art: <KingFace mood="scared" /> },
            { id: 'checkmate', label: { all: 'Checkmate', explorer: 'Mate!' }, art: <KingFace mood="mate" /> },
            { id: 'stalemate', label: { all: 'Stalemate', explorer: 'Tie!' }, art: <KingFace mood="stuck" /> },
            { id: 'nothing', label: 'All fine', art: <KingFace mood="calm" /> },
          ],
          correct: item.answer,
        };
      case 'count':
        return { options: countOpts.map((n) => ({ id: String(n), label: String(n), art: <Dots n={n} /> })), correct: String(item.answer) };
      case 'value': {
        const a = PIECE_NAME[item.a.toUpperCase()];
        const b = PIECE_NAME[item.b.toUpperCase()];
        return {
          options: [
            { id: 'a', label: cap(a), icon: 'candy' },
            { id: 'b', label: cap(b), icon: 'candy' },
            { id: 'same', label: 'Same!', icon: 'heart' },
          ],
          correct: valueAnswer(item.a, item.b),
        };
      }
      case 'trade':
        return yesNo(item.answer, { all: 'Good trade!', champion: 'Good' }, { all: 'Bad trade!', champion: 'Bad' });
      case 'can-castle':
      case 'bishop-reach':
        return yesNo(item.answer);
      default:
        return { options: [], correct: '' };
    }
  }, [item, countOpts]);

  // ---------- explanations ----------
  const explain = (): { say: BandText | BandText[]; arrows?: Arrow[]; tones?: Partial<Record<Sq, SquareTone>> } => {
    switch (item.kind) {
      case 'status2':
      case 'status4': {
        const s = statusOf(item.fen);
        const arrows = king ? attackers.map((a) => ({ from: a, to: king, color: 'red' as const })) : [];
        const who = attackers[0] ? PIECE_NAME[fenPlacement(item.fen)[attackers[0]]!.toUpperCase()] : 'piece';
        const tones = king ? { [king]: 'focus' as SquareTone } : {};
        if (s === 'check') return { say: { all: `The ${who} attacks the king. That's check! He can still get away.`, champion: `The ${who} gives check, but the king can escape.` }, arrows, tones };
        if (s === 'checkmate') return { say: { all: `The ${who} attacks the king and he can't escape. Checkmate!`, champion: 'Check with no escape: checkmate.' }, arrows, tones };
        if (s === 'stalemate') return { say: { all: "The king can't move, but nobody attacks him. Stalemate: it's a tie!", champion: 'No legal moves and no check: stalemate, a draw.' }, tones };
        return { say: { all: 'Nobody is attacking the king. He is calm!', champion: 'The king is not attacked.' }, tones };
      }
      case 'count':
        // Most count items are knights; one bonus item is a rook.
        return Object.values(item.pieces).some((p) => p?.toUpperCase() === 'R')
          ? { say: { all: `The rook can zoom to ${item.answer} squares!`, champion: `${item.answer} squares.` } }
          : { say: { all: `The knight can jump to ${item.answer} squares!`, champion: `${item.answer} squares.` } };
      case 'value': {
        const [a, b] = [item.a.toUpperCase(), item.b.toUpperCase()];
        // One recorded sentence per piece, said one after the other.
        return { say: [CANDY_LINE[a], CANDY_LINE[b]] };
      }
      case 'trade': {
        const t = tradeOutcome(item.fen, item.move)!;
        const line = t.loss ? `You win ${t.gain} and give back ${t.loss}.` : `You win ${t.gain}, and nobody can take back!`;
        return { say: [line, t.net >= 0 ? 'Good trade!' : 'Bad trade!'], arrows: t.recapture ? [{ from: t.recapture.from, to: t.recapture.to, color: 'red' }] : [] };
      }
      case 'can-castle': {
        if (item.answer) return { say: { all: 'The king has not moved, the path is empty and safe. Castle away!', champion: 'All castling rules are met.' } };
        const r = item.reason ?? castleReasons(item.fen, item.side)[0];
        return { say: REASONS.find((x) => x.id === r)?.say ?? 'Castling is not allowed here.' };
      }
      case 'bishop-reach': {
        const home = isLight(bishopSq!) ? 'light' : 'dark';
        const star = isLight(item.star) ? 'light' : 'dark';
        return { say: home === star ? `The bishop and the star are both on ${home} squares. She can get there!` : `The bishop lives on ${home} squares, but the star is on a ${star} square. Never!` };
      }
      case 'munch':
        return { say: 'Every glowing piece can gobble the cookie!', tones: Object.fromEntries(item.answer.map((s) => [s, 'good' as SquareTone])) };
      default:
        return { say: '' };
    }
  };
  const [shown, setShown] = useState<ReturnType<typeof explain> | null>(null);

  // ---------- hints ----------
  useEffect(() => {
    const e = explain();
    const steps: HintStep[] = [];
    switch (item.kind) {
      case 'status2':
      case 'status4':
        steps.push({ say: item.kind === 'status2' ? 'Check means a piece attacks the king.' : 'Is the king attacked? Can he move?' }, { say: 'Look at the king. Who can reach him?', tones: king ? { [king]: 'hint' } : {} }, { say: 'Follow the arrows!', arrows: e.arrows, tones: king ? { [king]: 'hint' } : {} });
        break;
      case 'count':
        steps.push({ say: 'Two steps and a turn. Try every direction!' }, { say: 'Look all around the piece.', tones: { [Object.keys(item.pieces)[0]]: 'hint' } }, { say: 'Count the dots!', art: Object.fromEntries(countDests.map((s) => [s, 'dot' as ArtKey])) });
        break;
      case 'value':
        steps.push({ say: 'Pawn 1, knight 3, bishop 3, rook 5, queen 9.' }, { say: 'Think about how much candy each one is worth.' }, { say: 'Here are the candies!', art: { c4: `candy:${CANDY[item.a.toUpperCase()]}` as ArtKey, f4: `candy:${CANDY[item.b.toUpperCase()]}` as ArtKey } });
        break;
      case 'trade':
        steps.push({ say: 'Count what you win, then what they can take back.' }, { say: 'Who can take back?', tones: tradeOutcome(item.fen, item.move)?.recapture ? { [tradeOutcome(item.fen, item.move)!.recapture!.from]: 'hint' } : {} }, { say: 'Follow the red arrow!', arrows: e.arrows });
        break;
      case 'can-castle':
        steps.push({ say: 'To castle: king and rook never moved, the path is empty, and no square is attacked.' }, { say: 'Look at the path between king and rook.', tones: pathTones(item.fen, item.side) });
        break;
      case 'bishop-reach':
        steps.push({ say: 'A bishop stays on one color forever.' }, { say: 'What color is the bishop on? And the star?', tones: { [bishopSq!]: 'hint', [item.star]: 'hint' } });
        break;
      case 'munch':
        steps.push({ say: 'Which of your pieces can reach the cookie?' }, { say: 'Here is one!', tones: { [item.answer[0]]: 'hint' } }, { say: 'The arrows show the munchers!', arrows: item.answer.map((s) => ({ from: s, to: item.target, color: 'green' as const })) });
        break;
    }
    player.setHints(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- finishing ----------
  const finish = (extra = 0) => {
    setPhase('done');
    player.celebrate('small');
    const hl = player.hintLevel;
    const m = mistakesRef.current + extra;
    later(() => onDone({ score: standardScore(m, hl), mistakes: m, hintLevel: hl }), 1400);
  };

  const oops = (line: BandText | BandText[], key?: string) => {
    mistakesRef.current += 1;
    setMistakes(mistakesRef.current);
    if (key) setWrong((w) => [...w, key]);
    player.mistake(line);
  };

  // Trade: play the capture, then the recapture, then show the scale.
  const playTrade = (then: () => void) => {
    if (item.kind !== 'trade') return;
    const t = tradeOutcome(item.fen, item.move)!;
    setPhase('show');
    const c = fenAfter(item.fen, item.move);
    setShownFen(c);
    setLastMove(item.move);
    player.sound('capture');
    later(() => {
      if (t.recapture) {
        setShownFen(fenAfter(c!, [t.recapture.from, t.recapture.to]));
        setLastMove([t.recapture.from, t.recapture.to]);
        player.sound('chomp');
      }
      setScale({ gain: t.gain, loss: t.loss });
    }, 800);
    later(then, 2200);
  };

  const press = (id: string) => {
    if (phase !== 'ask') return;
    const e = explain();
    const right = id === correct;
    if (item.kind === 'trade') {
      playTrade(() => {
        if (right) {
          player.sound('pop');
          player.say([{ all: 'Yes!', champion: 'Correct.' }, ...[e.say].flat()], 'cheer');
          finish();
        } else {
          setShownFen(null);
          setLastMove(null);
          setPhase('ask');
          oops(e.say, id);
        }
      });
      return;
    }
    setShown(e);
    setReveal(true);
    if (!right) return oops(e.say, id);
    player.sound('pop');
    if (item.kind === 'status2' && item.answer === 'check') {
      setShown(null);
      setPhase('attacker');
      player.say({ all: "Yes, check! Now tap who's attacking!", champion: 'Check. Tap the attacker.' }, 'cheer');
      return;
    }
    if (item.kind === 'can-castle' && !item.answer && item.reason && band !== 'sprout') {
      setShown(null);
      setPhase('reason');
      player.say({ all: "Right, you can't! Why not?", champion: 'Correct. Why not?' }, 'cheer');
      return;
    }
    player.say([{ all: 'Yes!', champion: 'Correct.' }, ...[e.say].flat()], 'cheer');
    finish();
  };

  const pressReason = (id: CastleReason) => {
    if (phase !== 'reason' || item.kind !== 'can-castle') return;
    const ok = castleReasons(item.fen, item.side).includes(id);
    const e = explain();
    if (!ok) return oops(e.say, `r-${id}`);
    setShown(e);
    player.sound('pop');
    player.say([{ all: 'Exactly!', champion: 'Correct.' }, ...[e.say].flat()], 'cheer');
    finish();
  };

  const onSquare = (sq: Sq) => {
    if (phase === 'attacker' && item.kind === 'status2') {
      if (sq === item.attacker) {
        setShown(explain());
        player.sound('check');
        player.say({ all: `Yes! That ${PIECE_NAME[fenPlacement(item.fen)[sq]!.toUpperCase()]} is attacking the king!`, champion: 'Correct.' }, 'cheer');
        finish();
      } else if (fenPlacement(item.fen)[sq] && sq !== king) oops("That one isn't attacking the king. Who can reach him?");
      return;
    }
    if (phase === 'munch' && item.kind === 'munch') {
      const pc = fenPlacement(item.fen)[sq];
      const turn = item.fen.split(' ')[1] as 'w' | 'b';
      if (!pc || (pc === pc.toUpperCase() ? 'w' : 'b') !== turn || pc.toUpperCase() === 'K') {
        if (sq === item.target) player.say('That is the cookie! Tap YOUR pieces that can eat it.');
        return;
      }
      player.sound('tick');
      setPicked((p) => (p.includes(sq) ? p.filter((x) => x !== sq) : [...p, sq]));
      return;
    }
    if (phase === 'ask' && item.kind === 'value') {
      if (sq === 'c4') press('a');
      else if (sq === 'f4') press('b');
    }
  };

  const munchDone = () => {
    if (item.kind !== 'munch' || phase !== 'munch') return;
    const ans = munchers(item.fen, item.target);
    const extra = picked.filter((s) => !ans.includes(s));
    const missing = ans.filter((s) => !picked.includes(s));
    if (!extra.length && !missing.length) {
      setShown(explain());
      player.sound('chomp');
      player.say({ all: 'Yes! All of them can munch it!', champion: 'Correct: all of them.' }, 'cheer');
      finish();
      return;
    }
    if (extra.length) {
      const name = PIECE_NAME[fenPlacement(item.fen)[extra[0]]!.toUpperCase()];
      setPicked((p) => p.filter((s) => !extra.includes(s)));
      oops(`The ${name} can't reach the cookie.`);
    } else oops(missing.length === 1 ? "There's one more muncher. Look again!" : `There are ${missing.length} more munchers!`);
  };

  // ---------- tray ----------
  const hintLevel = player.hintLevel;
  useEffect(() => {
    let buttons: TrayButton[] | null = null;
    if (phase === 'ask')
      buttons = options.map((o) => ({
        id: o.id,
        label: o.label,
        icon: o.icon,
        art: <span className="k-quiz-ans">{o.art}</span>,
        variant: hintLevel >= 4 && o.id === correct ? 'go' : 'plain',
        disabled: wrong.includes(o.id),
        onPress: () => press(o.id),
      }));
    else if (phase === 'reason' && item.kind === 'can-castle') {
      const ids: CastleReason[] = ['king-moved', 'in-the-way', 'in-check', 'path-attacked'];
      if (item.reason === 'rook-moved') ids[0] = 'rook-moved';
      buttons = ids.map((id) => {
        const r = REASONS.find((x) => x.id === id)!;
        return { id, label: r.label, icon: r.icon, art: <span className="k-quiz-ans" />, variant: hintLevel >= 4 && id === item.reason ? 'go' : 'plain', disabled: wrong.includes(`r-${id}`), onPress: () => pressReason(id) };
      });
    } else if (phase === 'munch') buttons = [{ id: 'done', label: 'Done!', icon: 'check', variant: 'go', disabled: !picked.length, onPress: munchDone }];
    player.setTray(buttons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, wrong, hintLevel, picked, options]);
  useEffect(() => () => player.setTray(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Level 4 for board answers: show them.
  useEffect(() => {
    if (hintLevel < 4) return;
    if (phase === 'attacker' && item.kind === 'status2') player.say('Tap the glowing piece!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintLevel]);

  // ---------- art ----------
  const art: Partial<Record<Sq, ArtKey[]>> = {};
  const add = (sq: Sq, a: ArtKey) => (art[sq] = [...(art[sq] ?? []), a]);
  const overlay: Partial<Record<Sq, ReactNode>> = {};
  const tones: Partial<Record<Sq, SquareTone>> = { ...(shown?.tones ?? {}) };
  const arrows: Arrow[] = [...(shown?.arrows ?? [])];
  if (item.kind === 'bishop-reach') {
    add(item.star, 'star');
    if (band === 'sprout' || reveal || mistakes > 0 || hintLevel >= 2) {
      overlay[bishopSq!] = <Sky light={isLight(bishopSq!)} />;
      overlay[item.star] = <Sky light={isLight(item.star)} />;
    }
  }
  if (item.kind === 'count' && (reveal || phase === 'done')) for (const s of countDests) add(s, 'dot');
  if (item.kind === 'value' && (reveal || phase === 'done')) {
    add('c4', `candy:${CANDY[item.a.toUpperCase()]}` as ArtKey);
    add('f4', `candy:${CANDY[item.b.toUpperCase()]}` as ArtKey);
  }
  if (item.kind === 'trade' && phase === 'ask') arrows.push({ from: item.move[0], to: item.move[1], color: 'blue' });
  if (item.kind === 'can-castle') {
    const c = item.fen.split(' ')[1] as 'w' | 'b';
    const r = c === 'w' ? '1' : '8';
    arrows.push({ from: 'e' + r, to: (item.side === 'k' ? 'g' : 'c') + r, color: 'blue' });
    if (item.reason === 'king-moved') add('e' + r, 'footprints');
  }
  if (item.kind === 'munch') {
    add(item.target, 'target');
    for (const s of picked) tones[s] = 'focus';
    if (phase === 'done') for (const s of item.answer) tones[s] = 'good';
  }
  if (item.kind === 'status2' && phase === 'attacker' && hintLevel >= 4 && item.attacker) tones[item.attacker] = 'hint';
  if ((item.kind === 'status2' || item.kind === 'status4') && king && statusOf(item.fen) !== 'nothing' && (reveal || phase === 'done')) add(king, 'check');

  const turn = ('fen' in item ? item.fen.split(' ')[1] : 'w') as 'w' | 'b';
  return (
    <div className={`k-quiz k-quiz-${item.kind}`}>
      <KidsBoard
        fen={fen}
        interactive={false}
        playerColor={turn}
        onSquareClick={onSquare}
        lastMove={lastMove}
        art={art}
        overlay={overlay}
        tones={tones}
        arrows={arrows}
        hint={phase === 'done' ? null : player.hint}
        label={boardLabel(item.kind, phase)}
      />
      {scale && <BalanceScale gain={scale.gain} loss={scale.loss} />}
      {phase === 'attacker' && <div className="k-quiz-banner">Tap the attacker!</div>}
    </div>
  );
}

function boardLabel(kind: QuizItem['kind'], phase: Phase): string {
  if (phase === 'attacker') return 'Chess board: tap the piece giving check';
  if (phase === 'munch') return 'Chess board: tap every piece that can capture the cookie';
  return `Chess board for the ${kind} question`;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** What each piece is worth in candies, one recorded sentence each. */
const CANDY_LINE: Record<string, BandText> = {
  P: { all: 'A pawn is 1 candy.', champion: 'A pawn is worth 1.' },
  N: { all: 'A knight is 3 candies.', champion: 'A knight is worth 3.' },
  B: { all: 'A bishop is 3 candies.', champion: 'A bishop is worth 3.' },
  R: { all: 'A rook is 5 candies.', champion: 'A rook is worth 5.' },
  Q: { all: 'A queen is 9 candies.', champion: 'A queen is worth 9.' },
};

function fenAfter(fen: string, move: [Sq, Sq]): string {
  // Local import-free helper: chess.js through tradeOutcome would recompute everything.
  const p = fenPlacement(fen);
  const moved = p[move[0]];
  delete p[move[0]];
  if (moved) p[move[1]] = moved;
  const turn = other(fen.split(' ')[1] as 'w' | 'b');
  return placementFen(p, turn);
}

function pathTones(fen: string, side: 'k' | 'q'): Record<Sq, SquareTone> {
  const r = fen.split(' ')[1] === 'w' ? '1' : '8';
  const files = side === 'k' ? ['f', 'g'] : ['b', 'c', 'd'];
  return Object.fromEntries(files.map((f) => [f + r, 'hint' as SquareTone]));
}

/** Scared / calm / checkmated / stuck king faces for the answer buttons. */
function KingFace({ mood }: { mood: 'scared' | 'calm' | 'mate' | 'stuck' }) {
  return (
    <svg className="k-quiz-face" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 14l5 4 7-9 7 9 5-4-2 10H10z" fill="var(--k-sun)" stroke="var(--k-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="20" cy="29" r="9" fill="#fffaf0" stroke="var(--k-ink)" strokeWidth="2.5" />
      {mood === 'mate' ? (
        <path d="M14.5 25.5l3 3M17.5 25.5l-3 3M22.5 25.5l3 3M25.5 25.5l-3 3" stroke="var(--k-ink)" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="16.5" cy="27" r={mood === 'scared' ? 2 : 1.5} fill="var(--k-ink)" />
          <circle cx="23.5" cy="27" r={mood === 'scared' ? 2 : 1.5} fill="var(--k-ink)" />
        </>
      )}
      {mood === 'calm' && <path d="M16 31.5c2 2 6 2 8 0" fill="none" stroke="var(--k-ink)" strokeWidth="1.8" strokeLinecap="round" />}
      {mood === 'scared' && <ellipse cx="20" cy="33" rx="2.2" ry="2.6" fill="var(--k-ink)" />}
      {mood === 'mate' && <path d="M16 34c2-2 6-2 8 0" fill="none" stroke="var(--k-ink)" strokeWidth="1.8" strokeLinecap="round" />}
      {mood === 'stuck' && <path d="M16 33h8" stroke="var(--k-ink)" strokeWidth="1.8" strokeLinecap="round" />}
      {mood === 'scared' && <path d="M33 2l-5 9h4l-4 8" fill="none" stroke="var(--k-coral-edge)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function Dots({ n }: { n: number }) {
  if (n > 8) return null;
  return (
    <span className="k-quiz-dots" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

function Sky({ light }: { light: boolean }) {
  return (
    <span className={`k-quiz-sky ${light ? 'sun' : 'moon'}`} aria-hidden="true">
      <KidsIcon name={light ? 'sun' : 'moon'} size={20} />
    </span>
  );
}
