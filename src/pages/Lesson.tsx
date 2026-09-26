import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { units, type DemoStep, type Lesson, type LessonStep, type MoveStep, type QuizStep, type Unit } from '../content';
import { Board, playMoveSound, type SquareTone } from '../chess/Board';
import { acceptsMove, colorName, fullMoveOf, moveNumberLabel, parseUci, sanToUci, turnOf, uciOf } from '../chess/utils';
import { useKeydown, useTimeouts } from '../lib/hooks';
import { BoardColumn } from '../components/BoardColumn';
import { Button, Feedback, ProgressBar, RichText } from '../components/ui';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import { getProfile, logActivity, updateProfile } from '../store/profile';
import { sound } from '../chess/sound';
import type { Arrow } from '../content/types';
import { MoveInput } from '../components/MoveInput';

function findLesson(id: string): { unit: Unit; lesson: Lesson; index: number } | null {
  for (const unit of units) {
    const index = unit.lessons.findIndex((l) => l.id === id);
    if (index >= 0) return { unit, lesson: unit.lessons[index], index };
  }
  return null;
}

function nextLessonAfter(id: string): Lesson | null {
  const all = units.flatMap((u) => u.lessons);
  const i = all.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < all.length ? all[i + 1] : null;
}

type StepResult = 'pending' | 'first-try' | 'retry';

function orientationFor(step: LessonStep): 'white' | 'black' {
  if (step.orientation) return step.orientation;
  if (step.kind === 'move' || step.kind === 'demo') return turnOf(step.fen) === 'w' ? 'white' : 'black';
  return 'white';
}

/* ---------------- Step: move ---------------- */
function MoveStepView({ step, onDone }: { step: MoveStep; onDone: (r: StepResult) => void }) {
  const [fen, setFen] = useState(step.fen);
  const [idx, setIdx] = useState(0);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [tones, setTones] = useState<Record<string, SquareTone>>({});
  const [arrows, setArrows] = useState<Arrow[]>(step.arrows ?? []);
  const [state, setState] = useState<'solving' | 'wrong' | 'done'>('solving');
  const [misses, setMisses] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const { later } = useTimeouts();
  const learner = turnOf(step.fen);

  const onMove = (mv: Move) => {
    if (state !== 'solving') return;
    const want = sanToUci(fen, step.solution[idx]) ?? '';
    const alts = idx === 0 ? (step.accept ?? []).map((a) => sanToUci(fen, a) ?? '') : [];
    setArrows([]);
    if (acceptsMove(mv, [want, ...alts])) {
      setFen(mv.after);
      setLastMove([mv.from, mv.to]);
      playMoveSound(mv.san);
      setTones({ [mv.to]: 'good' });
      const next = idx + 1;
      if (next >= step.solution.length || mv.san.endsWith('#') || alts.includes(uciOf(mv))) {
        setState('done');
        sound('good');
        onDone(misses === 0 ? 'first-try' : 'retry');
        return;
      }
      setIdx(next);
      later(() => {
        const reply = new Chess(mv.after).move(step.solution[next]);
        setFen(reply.after);
        setLastMove([reply.from, reply.to]);
        setTones({});
        playMoveSound(reply.san);
        setIdx(next + 1);
      }, 450);
    } else {
      const before = fen;
      setFen(mv.after);
      setLastMove([mv.from, mv.to]);
      setTones({ [mv.to]: 'bad' });
      sound('bad');
      setMisses((n) => n + 1);
      setShowHint(true);
      setState('wrong');
      later(() => {
        setFen(before);
        setLastMove(null);
        setTones({});
        setState('solving');
      }, 750);
    }
  };

  const reveal = () => {
    const want = sanToUci(fen, step.solution[idx]);
    if (want) {
      const u = parseUci(want);
      setArrows([{ from: u.from, to: u.to, color: 'blue' }]);
    }
    setMisses((n) => n + 1);
  };

  return (
    <StepLayout
      board={
        <Board
          fen={fen}
          orientation={orientationFor(step)}
          interactive={state === 'solving'}
          playerColor={learner}
          onMove={onMove}
          lastMove={lastMove}
          tones={tones}
          arrows={arrows}
          marks={idx === 0 && state !== 'done' ? step.marks : undefined}
        />
      }
      below={<MoveInput id="lesson-move" fen={fen} enabled={state === 'solving'} onMove={onMove} />}
      caption={`${colorName(learner)} to play`}
    >
      {step.title && <h2>{step.title}</h2>}
      <RichText text={step.text} />
      {state === 'done' ? (
        <Feedback tone="good" icon="check" title="Correct" body={<RichText text={step.success} />} />
      ) : (
        <>
          {state === 'wrong' && <Feedback tone="bad" icon="x" title="Not quite" />}
          {showHint && state !== 'wrong' && <Feedback tone="info" icon="bulb" title="Hint" body={step.hint} />}
          <div className="btn-row">
            {!showHint && (
              <Button icon="bulb" onClick={() => setShowHint(true)}>
                Hint
              </Button>
            )}
            {showHint && (
              <Button variant="ghost" icon="eye" onClick={reveal}>
                Show the move
              </Button>
            )}
          </div>
        </>
      )}
    </StepLayout>
  );
}

/* ---------------- Step: demo ---------------- */
function DemoStepView({ step, onDone }: { step: DemoStep; onDone: (r: StepResult) => void }) {
  const [ply, setPly] = useState(0);
  const positions = useMemo(() => {
    const c = new Chess(step.fen);
    const out: { fen: string; last: [string, string] | null; san: string }[] = [{ fen: step.fen, last: null, san: '' }];
    for (const san of step.moves) {
      const m = c.move(san);
      out.push({ fen: c.fen(), last: [m.from, m.to], san: m.san });
    }
    return out;
  }, [step]);
  const done = ply >= step.moves.length;
  useEffect(() => {
    if (done) onDone('pending');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  const go = (n: number) => {
    const next = Math.max(0, Math.min(step.moves.length, n));
    if (next > ply) playMoveSound(positions[next].san);
    setPly(next);
  };
  useKeydown((e) => {
    if (e.key === 'ArrowRight') go(ply + 1);
    if (e.key === 'ArrowLeft') go(ply - 1);
  });
  const note = ply > 0 ? step.notes?.[ply - 1] : undefined;
  const startTurn = turnOf(step.fen);
  // Number White's moves, and the first move when Black starts.
  const moveNo = (i: number) => (i === 0 || (i + (startTurn === 'b' ? 1 : 0)) % 2 === 0 ? moveNumberLabel(i, fullMoveOf(step.fen), startTurn) : '');
  return (
    <StepLayout
      board={<Board fen={positions[ply].fen} orientation={orientationFor(step)} lastMove={positions[ply].last} arrows={ply === 0 ? step.arrows : undefined} marks={ply === 0 ? step.marks : undefined} />}
      caption={`Move ${ply} of ${step.moves.length}`}
    >
      {step.title && <h2>{step.title}</h2>}
      <RichText text={step.text} />
      <div className="demo-moves">
        {positions.slice(1).map((p, i) => (
          <button key={i} className={`demo-move ${i + 1 === ply ? 'cur' : ''} ${i + 1 > ply ? 'future' : ''}`} onClick={() => go(i + 1)}>
            <span className="faint">{moveNo(i)}</span>
            {p.san}
          </button>
        ))}
      </div>
      {note && (
        <div className="note-card">
          <span className="note-move mono">{positions[ply].san}</span>
          <RichText text={note} />
        </div>
      )}
      <div className="btn-row">
        <button className="icon-btn" aria-label="Previous move" onClick={() => go(ply - 1)} disabled={ply === 0}>
          <Icon name="prev" />
        </button>
        <Button variant={done ? 'secondary' : 'primary'} iconRight="next" onClick={() => go(ply + 1)} disabled={done}>
          {ply === 0 ? 'Play the first move' : 'Next move'}
        </Button>
        <button className="icon-btn" aria-label="Replay from start" onClick={() => go(0)} disabled={ply === 0}>
          <Icon name="first" />
        </button>
      </div>
    </StepLayout>
  );
}

/* ---------------- Step: quiz ---------------- */
function QuizStepView({ step, onDone }: { step: QuizStep; onDone: (r: StepResult) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const correct = step.choices.findIndex((c) => c.correct);
  const solved = picked.includes(correct);
  const pick = (i: number) => {
    if (solved || picked.includes(i)) return;
    setPicked((p) => [...p, i]);
    if (i === correct) {
      sound('good');
      onDone(picked.length === 0 ? 'first-try' : 'retry');
    } else sound('bad');
  };
  const last = picked[picked.length - 1];
  const content = (
    <>
      {step.title && <h2>{step.title}</h2>}
      <RichText text={step.text} />
      <div className="choices" role="list">
        {step.choices.map((c, i) => {
          const state = picked.includes(i) ? (i === correct ? 'right' : 'wrong') : solved ? 'dim' : '';
          return (
            <button key={i} className={`choice ${state}`} onClick={() => pick(i)} disabled={solved && i !== correct}>
              <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
              <span>{c.text}</span>
              {state === 'right' && <Icon name="check" className="choice-icon" />}
              {state === 'wrong' && <Icon name="x" className="choice-icon" />}
            </button>
          );
        })}
      </div>
      {last !== undefined && (
        <Feedback tone={last === correct ? 'good' : 'bad'} icon={last === correct ? 'check' : 'x'} title={last === correct ? 'Right' : 'Not this one'} body={step.choices[last].why} />
      )}
    </>
  );
  if (!step.fen) return <div className="step-solo card">{content}</div>;
  return (
    <StepLayout board={<Board fen={step.fen} orientation={orientationFor(step)} arrows={step.arrows} marks={step.marks} />} caption={`${colorName(turnOf(step.fen))} to move`}>
      {content}
    </StepLayout>
  );
}

/* ---------------- Step: read ---------------- */
function ReadStepView({ step }: { step: Extract<LessonStep, { kind: 'read' }> }) {
  const content = (
    <>
      {step.title && <h2>{step.title}</h2>}
      <RichText text={step.text} />
    </>
  );
  if (!step.fen) return <div className="step-solo card">{content}</div>;
  return (
    <StepLayout board={<Board fen={step.fen} orientation={orientationFor(step)} arrows={step.arrows} marks={step.marks} lastMove={step.lastMove ?? null} />} caption={`${colorName(turnOf(step.fen))} to move`}>
      {content}
    </StepLayout>
  );
}

function StepLayout({ board, caption, children, below }: { board: React.ReactNode; caption?: string; children: React.ReactNode; below?: React.ReactNode }) {
  return (
    <div className="trainer">
      <BoardColumn>
        {caption && <div className="board-caption">{caption}</div>}
        {board}
        {below}
      </BoardColumn>
      <aside className="panel lesson-panel">{children}</aside>
    </div>
  );
}

/* ---------------- Page ---------------- */
export function LessonPage({ id }: { id: string }) {
  const found = findLesson(id);
  const [stepIdx, setStepIdx] = useState(0);
  const [results, setResults] = useState<Record<number, StepResult>>({});
  /** XP awarded once the lesson is complete; null while it is in progress. */
  const [xpGained, setXpGained] = useState<number | null>(null);
  const enterRef = useRef<(() => void) | null>(null);
  useKeydown((e) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement)) enterRef.current?.();
  });

  if (!found) {
    return (
      <div className="empty">
        Lesson not found. <Button onClick={() => navigate('learn')}>Back to Learn</Button>
      </div>
    );
  }
  const { unit, lesson } = found;
  const step = lesson.steps[stepIdx];
  const result = results[stepIdx];
  // Demos report 'pending' once fully played through; exercises report how they were solved.
  const canContinue = step.kind === 'read' ? true : step.kind === 'demo' ? result === 'pending' : result === 'first-try' || result === 'retry';
  const isDemo = step.kind === 'demo';
  const graded = lesson.steps.map((s, i) => ({ s, r: results[i] })).filter(({ s }) => s.kind === 'move' || s.kind === 'quiz');
  const firstTry = graded.filter((g) => g.r === 'first-try').length;

  const complete = () => {
    const score = graded.length ? firstTry / graded.length : 1;
    const prev = getProfile().lessons[lesson.id];
    const xp = prev?.done ? 10 : 30 + graded.length * 4;
    updateProfile((d) => {
      d.lessons[lesson.id] = { done: true, t: Date.now(), score: Math.max(score, prev?.score ?? 0) };
      logActivity(d, xp, 'lessons');
    });
    setXpGained(xp);
    sound('complete');
  };

  const next = () => {
    if (stepIdx + 1 >= lesson.steps.length) complete();
    else setStepIdx(stepIdx + 1);
  };
  enterRef.current = canContinue && xpGained === null ? next : null;

  if (xpGained !== null) {
    const nl = nextLessonAfter(lesson.id);
    return (
      <div className="lesson-done card">
        <div className="lesson-done-badge">
          <Icon name="check" size={34} />
        </div>
        <div className="eyebrow">{unit.title}</div>
        <h1>{lesson.title}: complete</h1>
        <p className="lede">
          {graded.length ? (
            <>
              You solved <strong>{firstTry}</strong> of {graded.length} exercises on the first try.
            </>
          ) : (
            'Lesson finished.'
          )}{' '}
          <span className="xp-chip">+{xpGained} XP</span>
        </p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          {nl && (
            <Button variant="primary" size="l" iconRight="right" onClick={() => navigate(`lesson/${nl.id}`)}>
              Next: {nl.title}
            </Button>
          )}
          <Button size="l" onClick={() => navigate('puzzles')}>
            Practise with puzzles
          </Button>
          <Button variant="ghost" size="l" onClick={() => navigate('learn')}>
            All lessons
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="lesson-top">
        <button className="icon-btn" aria-label="Back to lessons" onClick={() => navigate('learn')}>
          <Icon name="left" />
        </button>
        <div className="lesson-top-text">
          <div className="eyebrow">{unit.title}</div>
          <h1 className="lesson-title">{lesson.title}</h1>
        </div>
        <div className="lesson-progress">
          <span className="num faint">
            {stepIdx + 1}/{lesson.steps.length}
          </span>
          <ProgressBar value={stepIdx + (canContinue ? 1 : 0)} max={lesson.steps.length} label="Lesson progress" />
        </div>
      </div>
      <div key={stepIdx} className="step-wrap">
        {step.kind === 'read' && <ReadStepView step={step} />}
        {step.kind === 'demo' && <DemoStepView step={step} onDone={(r) => setResults((x) => ({ ...x, [stepIdx]: r }))} />}
        {step.kind === 'quiz' && <QuizStepView step={step} onDone={(r) => setResults((x) => ({ ...x, [stepIdx]: r }))} />}
        {step.kind === 'move' && <MoveStepView step={step} onDone={(r) => setResults((x) => ({ ...x, [stepIdx]: r }))} />}
      </div>
      <div className="lesson-nav">
        <Button variant="ghost" icon="left" onClick={() => setStepIdx(Math.max(0, stepIdx - 1))} disabled={stepIdx === 0}>
          Back
        </Button>
        <Button variant={canContinue ? 'primary' : 'secondary'} size="l" iconRight="right" onClick={next} disabled={!canContinue && !isDemo}>
          {stepIdx + 1 >= lesson.steps.length ? 'Finish lesson' : isDemo && !canContinue ? 'Skip demo' : 'Continue'}
        </Button>
      </div>
    </>
  );
}
