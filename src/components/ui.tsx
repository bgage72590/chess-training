import { Fragment, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import { sound } from '../chess/sound';
import { useReveal } from '../lib/hooks';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  icon,
  iconRight,
  size = 'm',
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string; iconRight?: string; size?: 's' | 'm' | 'l' }) {
  return (
    <button type="button" className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 's' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 's' ? 16 : 18} />}
    </button>
  );
}

export function ProgressBar({ value, max = 1, tone = 'accent', label }: { value: number; max?: number; tone?: 'accent' | 'good'; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar bar-${tone}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, max = 1, size = 88, stroke = 8, children, tone = 'accent' }: { value: number; max?: number; size?: number; stroke?: number; children?: ReactNode; tone?: 'accent' | 'good' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track, var(--surface-3))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === 'good' ? 'var(--good)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.2,0.7,0.2,1)' }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Pill({ children, tone = 'neutral', icon }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'good' | 'bad' | 'warn' | 'info'; icon?: string }) {
  return (
    <span className={`pill pill-${tone}`}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {children && <p className="lede">{children}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

/** A line chart of values over attempts, sized by its viewBox. Needs at least two values. */
export function Sparkline({ values, height = 64 }: { values: number[]; height?: number }) {
  const width = 240;
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pad = 6;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), pad + (1 - (v - min) / span) * (height - pad * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${height - pad} L${pts[0][0].toFixed(1)},${height - pad} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill="var(--accent-soft)" opacity="0.8" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--accent)" />
    </svg>
  );
}

/** Renders the small markup used in lesson text: **bold**, `code`, paragraphs, "- " bullets. */
export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="rich">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        const bullets = lines.findIndex((l) => l.trim().startsWith('- '));
        if (bullets > 0) {
          return (
            <Fragment key={i}>
              <p>{inline(lines.slice(0, bullets).join(' '))}</p>
              <ul>
                {lines.slice(bullets).map((l, j) => (
                  <li key={j}>{inline(l.trim().replace(/^- /, ''))}</li>
                ))}
              </ul>
            </Fragment>
          );
        }
        return <p key={i}>{inline(lines.join(' '))}</p>;
      })}
    </div>
  );
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else out.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/**
 * A feedback banner: an icon, a bold title and an optional body line. Extra lines can be
 * passed as children (give them the `feedback-body` class). `reveal` scrolls it into view when
 * it appears: on phones the panel sits under the board, so a move's result can land below the fold.
 */
export function Feedback({
  tone,
  icon,
  title,
  body,
  children,
  reveal,
}: {
  tone: 'good' | 'bad' | 'warn' | 'info';
  icon: string | ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  reveal?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, !!reveal);
  return (
    <div ref={ref} className={`feedback feedback-${tone}`}>
      {typeof icon === 'string' ? <Icon name={icon} /> : icon}
      <div>
        {title && <strong>{title}</strong>}
        {body && <span className="feedback-body">{body}</span>}
        {children}
      </div>
    </div>
  );
}

/**
 * Seconds left until `endsAt`, as a stat value. Only this component re-renders while the
 * clock runs. Calls `onExpire` at zero; from `warnAt` seconds it turns red (and ticks, if asked).
 */
export function Countdown({ endsAt, warnAt, tick = false, onExpire, format = (s) => `${s}s` }: { endsAt: number; warnAt: number; tick?: boolean; onExpire: () => void; format?: (seconds: number) => string }) {
  const [now, setNow] = useState(Date.now);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const expire = useRef(onExpire);
  const prev = useRef<number | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    expire.current = onExpire;
  });
  // Tick until the deadline, then stop; a new later deadline starts it again.
  const done = left === 0;
  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [done]);
  useEffect(() => {
    if (left > 0) {
      fired.current = false;
      if (tick && prev.current !== null && left < prev.current && left <= warnAt) sound('tick');
    } else if (!fired.current) {
      fired.current = true;
      expire.current();
    }
    prev.current = left;
  }, [left, warnAt, tick]);
  return <div className={`stat-value num ${left <= warnAt ? 'danger' : ''}`}>{format(left)}</div>;
}
