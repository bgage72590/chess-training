// A 3x4 number keypad with backspace and OK (parent gate, PIN).
import { KidsIcon } from './KidsIcon';

export function Keypad({ value, onChange, onOk, max = 4 }: { value: string; onChange(v: string): void; onOk(): void; max?: number }) {
  const press = (d: string) => value.length < max && onChange(value + d);
  return (
    <div className="k-keypad" role="group" aria-label="Number keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" className="k-key" onClick={() => press(d)}>
          {d}
        </button>
      ))}
      <button type="button" className="k-key k-key-soft" aria-label="Delete" onClick={() => onChange(value.slice(0, -1))}>
        <KidsIcon name="back" size={26} />
      </button>
      <button type="button" className="k-key" onClick={() => press('0')}>
        0
      </button>
      <button type="button" className="k-key k-key-ok" aria-label="OK" onClick={onOk} disabled={!value}>
        <KidsIcon name="check" size={26} />
      </button>
    </div>
  );
}
