import { useEffect, useState } from 'react';
import './qr.css';

/** A QR code (rendered as one SVG path) so a phone can scan `text`. The generator loads on first use. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const [shape, setShape] = useState<{ n: number; d: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void import('qrcode-generator').then(({ default: qrcode }) => {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      if (alive) setShape({ n, d });
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
