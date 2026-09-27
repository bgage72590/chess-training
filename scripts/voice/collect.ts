// Lists every line Kids mode can say aloud, for scripts/voice/render.py.
// Parses src/kids (oxc parser, via rolldown) and keeps sentence-like string literals (lines
// built at run time are recorded for every value when the values are few and predictable, such
// as piece names, squares, buddy names and small numbers; the rest use the device voice).
// Output: [{ key, text }] as JSON on stdout.
//   npx tsx scripts/voice/collect.ts > /tmp/lines.json
import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'rolldown/experimental';
import { clipKey, spokenText } from '../../src/kids/lib/clipKey';

const ROOT = path.resolve(import.meta.dirname, '../../src/kids');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts') ? [p] : [];
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
/** Most versions of one template to record (a line with a square and a number is too many). */
const MAX_VERSIONS = 70;

/** The values a ${...} placeholder can take, guessed from its code; null when unknown. */
function valuesFor(expr: string): string[] | null {
  const e = expr.toLowerCase();
  if (/buddy/.test(e)) return BUDDIES;
  if (/target\[0\]/.test(e)) return FILES;
  if (/target\[1\]/.test(e)) return RANKS;
  if (/^(target|sq|square)$/.test(e.trim())) return SQUARES;
  if (/color|^home$|^star$/.test(e.trim())) return ['light', 'dark'];
  if (/name|piece|who|guard/.test(e)) return PIECES;
  if (/^(n|count|left|left\.length|targets\.length|total|gain|loss|t\.gain|t\.loss|item\.answer|item\.count)$/.test(e.trim())) return NUMBERS;
  return null;
}

/** Records each version of a template line whose placeholders have known values. */
function expand(quasis: string[], exprs: string[]) {
  const sets = exprs.map(valuesFor);
  // Colons mark board labels for screen readers ("Paint board: 3 squares left"), not speech.
  if (sets.some((v) => !v) || !isLine(quasis.join('X')) || quasis.join('').includes(':')) return;
  if (sets.reduce((n, v) => n * v!.length, 1) > MAX_VERSIONS) return;
  const walk = (i: number, acc: string) => {
    if (i === exprs.length) return add(acc);
    for (const v of sets[i]!) walk(i + 1, acc + v + quasis[i + 1]);
  };
  walk(0, quasis[0]);
}

type Node = { type?: string; [k: string]: unknown };
let source = '';
function visit(node: unknown) {
  if (Array.isArray(node)) return node.forEach(visit);
  if (!node || typeof node !== 'object') return;
  const n = node as Node;
  if (n.type === 'ImportDeclaration' || n.type === 'ExportAllDeclaration') return;
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
