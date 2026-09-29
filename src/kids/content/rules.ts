// Pack C, Rules and Mates: the quiz and mate-drill activities, and the find-move level sets for
// protect, escape, en passant (spec 13.9 to 13.11). Every answer is recomputed by validate() in tests.
import type { AgeBand, ItemMeta, KidsPack, LevelSet, PieceCode } from '../activities/types';
import type { FindMoveItem } from '../activities/findMove/logic';
import type { QuizItem } from '../activities/quiz/logic';
import type { MateDrillItem } from '../activities/mateDrill/logic';
import { quizActivity } from '../activities/quiz';
import { mateDrillActivity } from '../activities/mateDrill';

type Q = QuizItem & ItemMeta;
type FM = FindMoveItem & ItemMeta;
type MD = MateDrillItem & ItemMeta;
const EC: AgeBand[] = ['explorer', 'champion'];
const C: AgeBand[] = ['champion'];

// ---------- w2: the bishop stays on her color ----------
// The intro bishop stands on f1, a light square, because the words say she lives on sunny light squares.

const reachSay = { all: 'Can the bishop ever reach the star?', sprout: 'Can the bishop get the star?' };
const reach = (id: string, from: string, star: string, answer: boolean, extra: Partial<Q> = {}): Q => ({ id, kind: 'bishop-reach', pieces: { [from]: 'B' }, star, answer, say: reachSay, ...extra }) as Q;

export const W2_BISHOP_COLOR: LevelSet<QuizItem> = {
  id: 'w2-bishop-color',
  activity: 'quiz',
  intro: [
    { say: { all: 'This bishop lives on sunny light squares. She can never step on a dark moon square!', champion: 'A bishop stays on one square color forever.' }, pieces: { f1: 'B' }, arrows: [{ from: 'g2', to: 'h3' }, { from: 'e2', to: 'a6' }] },
    { say: 'Is the star on her color? Then she can reach it!', pieces: { f1: 'B' }, art: { d3: 'star' }, move: ['f1', 'd3'], ms: 1200 },
  ],
  items: [
    reach('b1', 'c1', 'c2', false),
    reach('b2', 'c1', 'h6', true),
    reach('b3', 'c1', 'd3', false, { tier: 2 }),
    reach('b4', 'f1', 'a6', true),
    reach('b5', 'c1', 'e3', true),
    reach('b6', 'f1', 'f2', false, { tier: 2 }),
    reach('b7', 'f1', 'g1', false),
    reach('b8', 'c1', 'd2', true, { tier: 2 }),
  ],
};

// ---------- w4: count the hops ----------

const countSay = { all: 'How many squares can the knight jump to?', champion: 'How many squares does the knight reach?' };
export const W4_KNIGHT_COUNT: LevelSet<QuizItem> = {
  id: 'w4-knight-count',
  activity: 'quiz',
  items: [
    { id: 'k1', kind: 'count', pieces: { d4: 'N' }, answer: 8, say: countSay },
    { id: 'k2', kind: 'count', pieces: { a1: 'N' }, answer: 2, say: { all: 'A knight in the corner. How many jumps?', champion: 'Knight in the corner: how many squares?' } },
    { id: 'k3', kind: 'count', pieces: { b1: 'N' }, answer: 3, say: countSay },
    { id: 'k4', kind: 'count', pieces: { g2: 'N' }, answer: 4, tier: 2, say: countSay },
    { id: 'k5', kind: 'count', pieces: { d4: 'R' }, answer: 14, tier: 3, say: { all: 'Surprise! How many squares can the rook zoom to?', champion: 'Bonus: how many squares does the rook reach?' } },
    { id: 'k6', kind: 'count', pieces: { h5: 'N' }, answer: 4, tier: 2, say: countSay },
    { id: 'k7', kind: 'count', pieces: { b4: 'N' }, answer: 6, tier: 2, say: countSay },
  ],
};

// ---------- w6: candy values, guard your friend, good trade? ----------

const valueSay = { all: 'Which one is worth more candy?', champion: 'Which piece is worth more?' };
const value = (id: string, a: PieceCode, b: PieceCode, extra: Partial<Q> = {}): Q => ({ id, kind: 'value', a, b, say: valueSay, ...extra }) as Q;

export const W6_CANDY: LevelSet<QuizItem> = {
  id: 'w6-candy',
  activity: 'quiz',
  intro: [
    { say: { all: 'Every piece is worth candy! Pawn 1, knight 3, bishop 3, rook 5, queen 9!', champion: 'Values: pawn 1, knight 3, bishop 3, rook 5, queen 9.' }, pieces: { b4: 'P', c4: 'N', d4: 'B', e4: 'R', f4: 'Q' }, art: { b4: 'candy:1', c4: 'candy:3', d4: 'candy:3', e4: 'candy:5', f4: 'candy:9' } },
  ],
  items: [
    value('v1', 'P', 'N'),
    value('v2', 'N', 'B', { tier: 2 }),
    value('v3', 'R', 'B'),
    value('v4', 'Q', 'R'),
    value('v5', 'P', 'Q'),
    value('v6', 'B', 'R', { tier: 2 }),
    { id: 'v7', kind: 'munch', fen: '4k3/8/8/4p3/8/3N2B1/8/4RK2 w - - 0 1', target: 'e5', answer: ['d3', 'g3', 'e1'], tier: 3, bands: EC, say: { all: 'Who can munch the cookie pawn? Tap them ALL, then press Done!', champion: 'Tap every piece that can capture the pawn, then Done.' } },
  ],
};

const fm = (id: string, fen: string, goal: FindMoveItem['goal'], extra: Partial<FM> = {}): FM => ({ id, fen, goal, ...extra });
const protectSay = { all: 'Your friend is in danger! Give it a guard.', champion: 'Defend the attacked piece.' };

export const W6_PROTECT: LevelSet<FindMoveItem> = {
  id: 'w6-protect',
  activity: 'find-move',
  items: [
    fm('s1', '4k3/8/8/8/1b6/2N5/8/R3K3 w - - 0 1', { kind: 'protect', square: 'c3' }, { say: protectSay }),
    fm('s2', '4k3/8/2n5/8/3R4/8/8/4K1N1 w - - 0 1', { kind: 'protect', square: 'd4' }, { say: { all: 'Guard your rook!', champion: 'Defend the rook on d4.' } }),
    fm('p3', '4k3/8/8/7b/8/8/8/3R1NK1 w - - 0 1', { kind: 'protect', square: 'd1' }, { tier: 2, say: { all: 'The bishop wants your rook! Only one piece can guard it.', champion: 'Defend the rook on d1. Only one move works.' } }),
    fm('p4', '4k3/8/8/8/1b6/8/3N4/R5K1 w - - 0 1', { kind: 'protect', square: 'd2' }, { say: protectSay }),
    fm('p5', '4k3/8/8/2q5/8/7K/5B2/R7 w - - 0 1', { kind: 'protect', square: 'f2' }, { tier: 2, say: protectSay }),
    fm('p6', '7k/8/8/8/8/2n5/4R3/6K1 w - - 0 1', { kind: 'protect', square: 'e2' }, { say: { all: 'Can your king guard the rook?', champion: 'Defend the rook on e2.' } }),
  ],
};

const tradeSay = { all: 'Good trade? Do you get more candy than you give?', champion: 'Is this capture a good trade?' };
export const W6_TRADE: LevelSet<QuizItem> = {
  id: 'w6-trade',
  activity: 'quiz',
  items: [
    { id: 't1', kind: 'trade', fen: '4k3/4r3/8/4n3/8/8/8/4RK2 w - - 0 1', move: ['e1', 'e5'], answer: false, say: tradeSay },
    { id: 't2', kind: 'trade', fen: '4k3/8/8/4n3/8/8/8/4RK2 w - - 0 1', move: ['e1', 'e5'], answer: true, say: tradeSay },
    { id: 't3', kind: 'trade', fen: '4k3/8/3p4/4q3/8/8/8/4RK2 w - - 0 1', move: ['e1', 'e5'], answer: true, say: tradeSay },
    { id: 't4', kind: 'trade', fen: '4k3/8/5p2/4n3/8/8/8/4QK2 w - - 0 1', move: ['e1', 'e5'], answer: false, tier: 2, say: tradeSay },
    { id: 't5', kind: 'trade', fen: '4k3/8/8/4p3/8/8/8/4RK2 w - - 0 1', move: ['e1', 'e5'], answer: true, say: tradeSay },
    { id: 't6', kind: 'trade', fen: '4k3/8/2n5/4r3/8/8/8/4QK2 w - - 0 1', move: ['e1', 'e5'], answer: false, tier: 2, say: tradeSay },
  ],
};

// ---------- w7: spot the check, escape, detective, stalemate, castle, en passant ----------

const spotSay = { all: 'Is the king in check?', sprout: 'Is the king in trouble?' };
const spot = (id: string, fen: string, attacker?: string, extra: Partial<Q> = {}): Q =>
  ({ id, kind: 'status2', fen, answer: attacker ? 'check' : 'nothing', ...(attacker ? { attacker } : {}), say: spotSay, ...extra }) as Q;

export const W7_SPOT_CHECK: LevelSet<QuizItem> = {
  id: 'w7-spot-check',
  activity: 'quiz',
  items: [
    spot('sc1', '4k3/8/8/8/8/8/8/4R1K1 b - - 0 1', 'e1'),
    spot('sc2', '4k3/8/8/8/8/8/8/3R2K1 b - - 0 1'),
    spot('sc3', '4k3/8/8/1B6/8/8/8/6K1 b - - 0 1', 'b5'),
    spot('sc4', '4k3/8/3N4/8/8/8/8/6K1 b - - 0 1', 'd6', { tier: 2 }),
    spot('sc5', '4k3/8/8/8/8/8/8/Q5K1 b - - 0 1', undefined, { tier: 2 }),
    spot('sc6', '4k3/5P2/8/8/8/8/8/4K3 b - - 0 1', 'f7', { tier: 2 }),
  ],
};

const escSay = { all: 'Your king is in check! Find every way out: run, block and capture.', sprout: 'Get the king out of danger!', champion: 'Find each way out of check.' };
const esc = (id: string, fen: string, ways: ('run' | 'block' | 'capture')[], extra: Partial<FM> = {}): FM =>
  fm(id, fen, { kind: 'escape', ways }, { say: escSay, tune: { sprout: { goal: { kind: 'escape', ways: 'any' } } }, ...extra });

export const W7_ESCAPE: LevelSet<FindMoveItem> = {
  id: 'w7-escape',
  activity: 'find-move',
  items: [
    esc('e1', 'R3r1k1/8/8/8/8/8/3N4/4K3 w - - 0 1', ['run', 'block', 'capture'], { tier: 2 }),
    esc('e2', '4k3/8/8/8/4r3/8/2B5/R2QK3 w - - 0 1', ['run', 'block', 'capture'], { tier: 2 }),
    esc('e3', '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', ['run'], { say: { all: 'Check! The king has to run.', sprout: 'Run, king, run!', champion: 'Get out of check.' } }),
    esc('e4', '4r1k1/8/8/8/8/8/8/3BK3 w - - 0 1', ['block', 'run']),
    esc('e5', '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1', ['capture', 'run']),
  ],
};

const detSay = { all: 'Detective Pip! Check, checkmate, stalemate, or all fine?', champion: 'Check, checkmate, stalemate or nothing?' };
const det = (id: string, fen: string, answer: 'check' | 'checkmate' | 'stalemate' | 'nothing', extra: Partial<Q> = {}): Q => ({ id, kind: 'status4', fen, answer, say: detSay, ...extra }) as Q;

export const W7_MATE_OR_NOT: LevelSet<QuizItem> = {
  id: 'w7-mate-or-not',
  activity: 'quiz',
  items: [
    det('d1', '7k/6Q1/6K1/8/8/8/8/8 b - - 0 1', 'checkmate'),
    det('d2', '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'stalemate'),
    det('d3', 'k7/8/1K6/8/8/8/8/R7 b - - 0 1', 'check'),
    det('d4', 'k7/8/1K6/8/8/8/8/7R b - - 0 1', 'nothing'),
    det('d5', 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', 'checkmate', { tier: 2 }),
    det('d6', 'k7/1Q6/1K6/8/8/8/8/8 b - - 0 1', 'checkmate', { tier: 2 }),
    det('d7', 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1', 'stalemate', { tier: 2 }),
    det('d8', '7k/7P/6K1/8/8/8/8/8 b - - 0 1', 'stalemate', { tier: 3 }),
  ],
};

export const W7_STALEMATE: LevelSet<QuizItem> = {
  id: 'w7-stalemate',
  activity: 'quiz',
  intro: [
    { say: { all: "Stalemate: the king can't move, but he's NOT in check. That's a tie!", champion: 'Stalemate: no legal moves and not in check. A draw.' }, fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', tones: { h8: 'focus' } },
  ],
  items: [
    det('st1', '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'stalemate'),
    det('st2', 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1', 'stalemate'),
    det('st3', '7k/6Q1/6K1/8/8/8/8/8 b - - 0 1', 'checkmate', { tier: 2 }),
    { id: 'st4', kind: 'move', move: { fen: 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1', goal: { kind: 'mate' } }, say: { all: 'Checkmate, not stalemate!', champion: 'Mate in one. Avoid stalemate.' } },
    { id: 'st5', kind: 'move', move: { fen: '7k/8/6K1/8/8/8/Q7/8 w - - 0 1', goal: { kind: 'mate' } }, tier: 2, say: { all: 'Checkmate, not stalemate!', champion: 'Mate in one. Avoid stalemate.' } },
  ],
};

const castleSay = { all: 'Can White castle this way?', champion: 'Is castling legal here?' };
const cc = (id: string, fen: string, side: 'k' | 'q', answer: boolean, reason?: 'king-moved' | 'in-the-way' | 'path-attacked' | 'in-check', extra: Partial<Q> = {}): Q =>
  ({ id, kind: 'can-castle', fen, side, answer, ...(reason ? { reason } : {}), bands: EC, say: { all: side === 'k' ? 'Can White castle on the short side?' : 'Can White castle on the long side?', champion: castleSay.champion }, ...extra }) as Q;

export const W7_CASTLE: LevelSet<QuizItem> = {
  id: 'w7-castle',
  activity: 'quiz',
  intro: [
    { say: { all: 'Castling: the king takes two big steps toward a rook, and the rook hops over him!', champion: 'Castling: king two squares toward the rook. The rook jumps over.' }, fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', move: ['e1', 'g1'], ms: 1400 },
  ],
  items: [
    { id: 'm1', kind: 'move', move: { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', goal: { kind: 'flag', flag: 'k' } }, say: { all: 'Castle your king to safety!', champion: 'Castle kingside.' } },
    { id: 'm2', kind: 'move', move: { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', goal: { kind: 'flag', flag: 'q' } }, say: { all: 'Castle the long way!', sprout: 'Castle to the big side!', champion: 'Castle queenside.' } },
    cc('c1', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'k', true),
    cc('c2', 'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1', 'k', false, 'king-moved', { tier: 2 }),
    cc('c3', '4k3/8/8/8/8/8/8/R3KB1R w KQ - 0 1', 'k', false, 'in-the-way'),
    cc('c4', '4k3/8/8/8/2b5/8/8/R3K2R w KQ - 0 1', 'k', false, 'path-attacked', { tier: 3 }),
    cc('c5', '4k3/8/8/8/2b5/8/8/R3K2R w KQ - 0 1', 'q', true, undefined, { tier: 2 }),
    cc('c6', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'q', true),
  ],
};

export const W7_EN_PASSANT: LevelSet<FindMoveItem> = {
  id: 'w7-en-passant',
  activity: 'find-move',
  intro: [
    { say: { all: "Sneaky pawn trick! A pawn that jumps two steps past yours can be caught, as if it moved only one.", champion: 'En passant: capture a pawn that just moved two squares, as if it moved one.' }, fen: '4k3/4p3/8/3P4/8/8/8/4K3 b - - 0 1', move: ['e7', 'e5'], ms: 1400 },
  ],
  items: [
    fm('ep1', '4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 2', { kind: 'flag', flag: 'e' }, { replay: { fen: '4k3/4p3/8/3P4/8/8/8/4K3 b - - 0 1', uci: 'e7e5' }, say: { all: "Black's pawn just jumped two steps! Catch it with the sneaky trick.", champion: 'Capture en passant.' } }),
    fm('ep2', '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', { kind: 'flag', flag: 'e' }, { replay: { fen: '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1', uci: 'd7d5' }, say: { all: 'Another jumpy pawn! Catch it in passing.', champion: 'Capture en passant.' } }),
    fm('pr1', '8/4P3/8/8/8/2k5/8/4K3 w - - 0 1', { kind: 'flag', flag: 'p' }, { tier: 2, say: { all: 'March the pawn to the end and pick a new piece!', champion: 'Promote the pawn.' } }),
  ],
};

// ---------- w8: checkmate drills ----------

const drill = (id: string, fen: string, method: MateDrillItem['method'], maxMoves: number, extra: Partial<MD> = {}): MD => ({ id, fen, method, maxMoves, ...extra });
const ladderSay = { all: 'Two rooks climb the ladder! Push the king to the edge and checkmate.', sprout: 'Climb the ladder to checkmate!', champion: 'Ladder mate with two rooks.' };
const boxSay = { all: 'Make the box smaller! Squeeze the king, then checkmate.', champion: 'Mate with king and queen.' };
const rookSay = { all: 'Just one rook and your king. Squeeze and checkmate!', champion: 'Mate with king and rook.' };

export const W8_LADDER: LevelSet<MateDrillItem> = {
  id: 'w8-ladder',
  activity: 'mate-drill',
  perRun: { sprout: 1, explorer: 2, champion: 2 },
  intro: [
    { say: { all: 'Rooks take turns climbing, like a ladder. One guards a row, the other gives check!', champion: 'The rooks alternate: one cuts off a rank, the other checks.' }, fen: '6k1/1R6/8/8/8/8/R7/6K1 w - - 0 1', move: ['a2', 'a8'], ms: 1400 },
  ],
  items: [
    drill('l1', '8/8/3k4/8/8/8/8/R3K2R w - - 0 1', 'ladder', 12, { say: ladderSay }),
    drill('l2', '8/8/8/8/4k3/8/8/R3K2R w - - 0 1', 'ladder', 12, { say: ladderSay }),
    drill('l3', '8/2k5/8/8/8/8/8/4K1RR w - - 0 1', 'ladder', 12, { tier: 2, say: ladderSay }),
  ],
};

export const W8_BOX: LevelSet<MateDrillItem> = {
  id: 'w8-box',
  activity: 'mate-drill',
  perRun: { explorer: 1, champion: 2 },
  items: [
    drill('x1', '8/8/8/4k3/8/8/8/4K2Q w - - 0 1', 'box', 15, { bands: EC, say: boxSay }),
    drill('x2', '8/8/2k5/8/8/8/8/3QK3 w - - 0 1', 'box', 15, { bands: EC, say: boxSay }),
    drill('x3', '8/8/8/8/8/5k2/8/Q3K3 w - - 0 1', 'box', 15, { bands: EC, tier: 2, say: boxSay }),
  ],
};

export const W8_ROOK_MATE: LevelSet<MateDrillItem> = {
  id: 'w8-rook-mate',
  activity: 'mate-drill',
  perRun: { champion: 1 },
  items: [
    drill('r1', '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', 'rook', 30, { bands: C, say: rookSay }),
    drill('r2', '8/8/8/8/3k4/8/8/4K2R w - - 0 1', 'rook', 30, { bands: C, say: rookSay }),
    drill('r3', '8/5k2/8/8/8/8/8/R3K3 w - - 0 1', 'rook', 30, { bands: C, say: rookSay }),
  ],
};

export const rulesPack: KidsPack = {
  id: 'rules',
  activities: [quizActivity, mateDrillActivity],
  levelSets: [W2_BISHOP_COLOR, W4_KNIGHT_COUNT, W6_CANDY, W6_PROTECT, W6_TRADE, W7_SPOT_CHECK, W7_ESCAPE, W7_MATE_OR_NOT, W7_STALEMATE, W7_CASTLE, W7_EN_PASSANT, W8_LADDER, W8_BOX, W8_ROOK_MATE],
};
