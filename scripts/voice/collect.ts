// Lists every line Kids mode can say aloud, for scripts/voice/render.py.
// Parses src/kids (oxc parser, via rolldown) and keeps sentence-like string literals (lines
// built at run time are recorded for every value when the values are few and predictable, such
// as piece names, squares, buddy names and small numbers; the rest use the device voice). The
// grown-up screens and the parent gate are left out: they are read, never spoken.
// Output: [{ key, text }] as JSON on stdout.
//   npx tsx scripts/voice/collect.ts > /tmp/lines.json
import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'rolldown/experimental';
import { clipKey, spokenText } from '../../src/kids/lib/clipKey';

const ROOT = path.resolve(import.meta.dirname, '../../src/kids');

/** Grown-up screens and what only they show: read, never spoken (the parent gate is never spoken at all). */
const GROWN_UP_ONLY = new Set(['screens/Grownups.tsx', 'ui/ParentGate.tsx', 'ui/Keypad.tsx', 'curriculum/skills.ts']);
// The voice download row and its downloader (grown-up copy, shown in Grownups.tsx).
for (const f of ['screens/VoicePackRow.tsx', 'player/voicePack.ts']) GROWN_UP_ONLY.add(f);

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts') && !GROWN_UP_ONLY.has(path.relative(ROOT, p).split(path.sep).join('/')) ? [p] : [];
  });
}

/** Sentence-like: starts upper-case, has letters, no code characters, and a space or end punctuation. */
function isLine(s: string): boolean {
  if (!/[A-Za-z]/.test(s) || !/^[A-Z0-9"'¡¿]/.test(s) || s.length > 400) return false;
  if (/[{}<>=/#;_\\|]|\.\w+\(|^M[\d.]/.test(s)) return false;
  return s.includes(' ') || /[!?.]$/.test(s);
}

const lines = new Map<string, string>();
const add = (raw: string) => {
  const s = raw.trim();
  if (!isLine(s)) return;
  const text = spokenText(s);
  lines.set(clipKey(text), text);
};

const PIECES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const BUDDIES = ['Shelly', 'Hop', 'Tuck', 'Fern', 'Olive', 'Bruno', 'Ember'];
const FILES = 'abcdefgh'.split('');
const RANKS = '12345678'.split('');
const SQUARES = FILES.flatMap((f) => RANKS.map((r) => f + r));
const NUMBERS = Array.from({ length: 16 }, (_, i) => String(i));
const COUNTS = Array.from({ length: 61 }, (_, i) => String(i)); // a bare `n`: move counts, dash scores
const RANK_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const STAR_WORDS = ['one star', 'two stars', 'three stars'];
// World and boss names come from the curriculum (loaded by path: it is app code, not a script).
const CURRICULUM = '../../src/kids/curriculum/worlds';
const { WORLDS, NODES } = (await import(CURRICULUM)) as { WORLDS: { title: string }[]; NODES: { title: string; boss?: boolean }[] };
const WORLD_TITLES = WORLDS.map((w) => w.title);
const BOSS_TITLES = NODES.filter((n) => n.boss).map((n) => n.title);
const PIECE_VALUES = ['1', '3', '5', '9'];
const GARDEN = Array.from({ length: 30 }, (_, i) => String(i + 1));
/** Most versions of one template to record (a line with a square and a number is too many). */
const MAX_VERSIONS = 70;

/** The values a ${...} placeholder can take, guessed from its code; null when unknown. */
function valuesFor(expr: string): string[] | null {
  const e = expr.toLowerCase();
  const t = e.trim();
  if (/way_label/.test(e)) return ['run', 'block', 'capture'];
  if (/^sw\.title$/.test(t)) return WORLD_TITLES;
  if (/^title$/.test(t)) return BOSS_TITLES;
  if (/^rank$/.test(t)) return RANK_NUMBERS;
  if (/^(got|want)$/.test(t)) return STAR_WORDS;
  if (/^(score|need)$/.test(t)) return ['1', '2', '3'];
  if (/^t\.(gain|loss)$/.test(t)) return PIECE_VALUES;
  if (/garden\[1\]/.test(e)) return GARDEN;
  if (/^n$/.test(t)) return COUNTS;
  if (/^rules$/.test(t)) return ['0', '1', '2', '3', '4', '5'];
  if (/buddy/.test(e)) return BUDDIES;
  if (/target\[0\]/.test(e)) return FILES;
  if (/target\[1\]/.test(e)) return RANKS;
  if (/^(target|sq|square)$/.test(e.trim())) return SQUARES;
  if (/color|^home$|^star$/.test(e.trim())) return ['light', 'dark'];
  if (/name|piece|who|guard/.test(e)) return PIECES;
  if (/^(count|left|left\.length|targets\.length|missing\.length|total|gain|loss|item\.answer|item\.count)$/.test(t)) return NUMBERS;
  return null;
}

/** Records each version of a template line whose placeholders have known values. */
function expandWhole(quasis: string[], exprs: string[]): boolean {
  const sets = exprs.map(valuesFor);
  // Colons mark board labels for screen readers ("Paint board: 3 squares left"), not speech.
  if (sets.some((v) => !v) || !isLine(quasis.join('X')) || quasis.join('').includes(':')) return false;
  if (sets.reduce((n, v) => n * v!.length, 1) > MAX_VERSIONS) return false;
  const walk = (i: number, acc: string) => {
    if (i === exprs.length) return add(acc);
    for (const v of sets[i]!) walk(i + 1, acc + v + quasis[i + 1]);
  };
  walk(0, quasis[0]);
  return true;
}

/**
 * Records a template line, or else each of its sentences: the app says a line without a
 * recording sentence by sentence when every sentence has one (speech.ts). This covers lines
 * with too many versions, and sentences next to a placeholder that cannot be guessed.
 */
function expand(quasis: string[], exprs: string[]) {
  if (expandWhole(quasis, exprs)) return;
  if (quasis.join('').includes(':')) return;
  let seg: { quasis: string[]; exprs: string[] } = { quasis: [''], exprs: [] };
  const flush = () => {
    const q = seg.quasis.map((x, i) => (i === 0 ? x.trimStart() : x));
    q[q.length - 1] = q[q.length - 1].trimEnd();
    if (seg.exprs.length ? true : q[0]) (seg.exprs.length ? expandWhole(q, seg.exprs) : add(q[0]));
    seg = { quasis: [''], exprs: [] };
  };
  quasis.forEach((q, i) => {
    // Split the static text after sentence ends; placeholders stay with their sentence.
    const pieces = q.split(/(?<=[.!?])\s+/);
    pieces.forEach((piece, j) => {
      if (j > 0) flush();
      seg.quasis[seg.quasis.length - 1] += piece;
    });
    if (i < exprs.length) {
      seg.exprs.push(exprs[i]);
      seg.quasis.push('');
    }
  });
  flush();
}

type Node = { type?: string; [k: string]: unknown };
let source = '';
function visit(node: unknown) {
  if (Array.isArray(node)) return node.forEach(visit);
  if (!node || typeof node !== 'object') return;
  const n = node as Node;
  if (n.type === 'ImportDeclaration' || n.type === 'ExportAllDeclaration') return;
  // Why the parent gate is asked for (requireGate's reason, <Gated reason>) shows only in the gate.
  if (n.type === 'CallExpression' && (n.callee as Node).type === 'Identifier' && (n.callee as { name?: string }).name === 'requireGate') return visit((n.arguments as unknown[]).slice(1));
  if (n.type === 'JSXAttribute' && (n.name as { name?: string }).name === 'reason') return;
  if (n.type === 'Literal' && typeof n.value === 'string') add(n.value);
  if (n.type === 'TemplateLiteral') {
    const quasis = (n.quasis as { value: { cooked: string } }[]).map((q) => q.value.cooked ?? '');
    const exprs = (n.expressions as { start: number; end: number }[]).map((x) => source.slice(x.start, x.end));
    if (!exprs.length) add(quasis[0]);
    else expand(quasis, exprs);
  }
  for (const [k, v] of Object.entries(n)) if (k !== 'parent' && v && typeof v === 'object') visit(v);
}

for (const f of files(ROOT)) {
  source = fs.readFileSync(f, 'utf8');
  visit(parseSync(f, source, { lang: f.endsWith('x') ? 'tsx' : 'ts' }).program);
}
process.stdout.write(JSON.stringify([...lines].map(([key, text]) => ({ key, text })), null, 0));
