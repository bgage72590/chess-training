import { units } from '../content';
import { navigate } from '../router';
import { useProfile } from '../store/profile';
import { nextLesson, lessonCounts } from '../lib/due';
import { Button, PageHeader, Pill, ProgressBar } from '../components/ui';
import { Icon } from '../components/Icon';

const LEVEL_TONE = { Beginner: 'good', Intermediate: 'info', Advanced: 'accent' } as const;

export function LearnPage() {
  const p = useProfile();
  const up = nextLesson(p);
  const { done, total } = lessonCounts(p);
  return (
    <>
      <PageHeader
        eyebrow="Curriculum"
        title="The path to strong club chess"
        actions={
          up && (
            <Button variant="primary" iconRight="right" onClick={() => navigate(`lesson/${up.lesson.id}`)}>
              Continue: {up.lesson.title}
            </Button>
          )
        }
      >
        Seven units in the order strong coaches teach them: rules and safety, mating patterns, tactics, opening play, a thinking routine, endgame technique, then strategy. {done} of {total} lessons complete.
      </PageHeader>

      <div className="units">
        {units.map((u, ui) => {
          const unitDone = u.lessons.filter((l) => p.lessons[l.id]?.done).length;
          return (
            <section key={u.id} className="unit">
              <div className="unit-head">
                <div className="unit-index num">{String(ui + 1).padStart(2, '0')}</div>
                <div className="unit-head-text">
                  <div className="btn-row">
                    <h2>{u.title}</h2>
                    <Pill tone={LEVEL_TONE[u.level]}>{u.level}</Pill>
                  </div>
                  <p className="muted">{u.tagline}</p>
                </div>
                <div className="unit-progress">
                  <span className="num faint">
                    {unitDone}/{u.lessons.length}
                  </span>
                  <ProgressBar value={unitDone} max={Math.max(1, u.lessons.length)} tone={unitDone === u.lessons.length && u.lessons.length ? 'good' : 'accent'} />
                </div>
              </div>
              {u.lessons.length === 0 ? (
                <div className="empty">Lessons for this unit are being written.</div>
              ) : (
                <div className="lesson-grid">
                  {u.lessons.map((l, li) => {
                    const prog = p.lessons[l.id];
                    const isNext = up?.lesson.id === l.id;
                    const steps = l.steps.filter((s) => s.kind === 'move' || s.kind === 'quiz').length;
                    return (
                      <button key={l.id} className={`lesson-card ${prog?.done ? 'done' : ''} ${isNext ? 'next' : ''}`} onClick={() => navigate(`lesson/${l.id}`)}>
                        <div className="lesson-card-top">
                          <span className="lesson-num num">
                            {ui + 1}.{li + 1}
                          </span>
                          {prog?.done ? (
                            <span className="lesson-state good">
                              <Icon name="check" size={16} /> {Math.round(prog.score * 100)}%
                            </span>
                          ) : isNext ? (
                            <span className="lesson-state accent">Up next</span>
                          ) : null}
                        </div>
                        <h3>{l.title}</h3>
                        <p className="muted">{l.summary}</p>
                        <div className="lesson-meta faint">
                          <span>
                            <Icon name="clock" size={14} /> {l.minutes} min
                          </span>
                          <span>
                            <Icon name="target" size={14} /> {steps} exercises
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
