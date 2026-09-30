import { useEffect, useState } from 'react';
import './qr.css';

export interface QrShape {
  /** Modules per side. */
  n: number;
  /** One SVG path with a unit square for every dark module. */
  d: string;
}

/** The QR code for `text`, or null when it cannot be made (too long, or the generator is not
 *  cached and the device is offline). The generator loads on first use. */
export async function qrShape(text: string): Promise<QrShape | null> {
  try {
    const { default: qrcode } = await import('qrcode-generator');
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n, d };
  } catch {
    return null;
  }
}

/** A QR code (rendered as one SVG path) so a phone can scan `text`. Without one, a blank square stays
 *  and the link or code beside it still works. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const [shape, setShape] = useState<QrShape | null>(null);
  useEffect(() => {
    let alive = true;
    void qrShape(text).then((s) => {
      if (alive) setShape(s);
    });
    return () => {
      alive = false;
    };
  }, [text]);
  if (!shape) return <div className="qr" aria-hidden="true" />;
  return (
    <svg className="qr" viewBox={`-2 -2 ${shape.n + 4} ${shape.n + 4}`} role="img" aria-label={label}>
      <rect x="-2" y="-2" width={shape.n + 4} height={shape.n + 4} fill="#fff" />
      <path d={shape.d} fill="#000" />
    </svg>
  );
}
