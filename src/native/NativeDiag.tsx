import { useEffect, useState } from 'react';
import { collectDiagnostics, postReport } from './diagnostics';

/** #/diag in native builds only (see diagnostics.ts): what this app can and cannot do on this device. */
export default function NativeDiag() {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [sent, setSent] = useState('');
  useEffect(() => {
    let live = true;
    void collectDiagnostics().then(async (r) => {
      if (!live) return;
      setReport(r);
      setSent(await postReport(r));
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="card">
      <h2>App diagnostics</h2>
      <p className="muted">{report ? `Checked. Report: ${sent || 'sending…'}` : 'Checking what works in this app…'}</p>
      <pre className="mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.78rem' }}>{report ? JSON.stringify(report, null, 1) : ''}</pre>
    </section>
  );
}
