import { useState } from 'react';
import { navigate } from '../router';
import { Button, PageHeader } from '../components/ui';
import { StorageSplitNote } from '../components/StorageSplitNote';
import { formatSyncCode, normalizeSyncCode } from './code';
import { syncAvailable, useSync } from './index';
import { linkDevice } from './SyncCard';
import { WhatSyncs } from './WhatSyncs';

/** Opened from a sync link (#/sync/CODE): offers to link this device. */
export function SyncJoinPage({ code: raw }: { code?: string }) {
  const s = useSync();
  const [busy, setBusy] = useState(false);
  const code = normalizeSyncCode(raw ?? '');
  if (!syncAvailable || !code) {
    return (
      <div className="empty">
        {syncAvailable ? 'This sync link is not valid.' : 'Sync is not available here.'} <Button onClick={() => navigate('settings')}>Settings</Button>
      </div>
    );
  }
  if (s.code === code) {
    return (
      <div className="empty">
        This device is already synced with this code. <Button onClick={() => navigate('home')}>Go to Today</Button>
      </div>
    );
  }
  return (
    <>
      <PageHeader eyebrow="Sync" title="Link this device?">
        Progress on this device will be combined with the synced copy, and kept up to date from then on.
      </PageHeader>
      <div className="card settings-section">
        <span className="stat-label">Sync code</span>
        <strong className="mono sync-code">{formatSyncCode(code)}</strong>
        {s.code && <p className="muted">This device currently syncs with another code; linking switches it to this one.</p>}
        <WhatSyncs joining />
        <StorageSplitNote mode="join" />
        <div className="btn-row">
          <Button
            variant="primary"
            icon="check"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void linkDevice(code, true).then((linked) => (linked ? navigate('home', { replace: true }) : setBusy(false)));
            }}
          >
            Link this device
          </Button>
          <Button variant="ghost" onClick={() => navigate('home', { replace: true })}>
            Not now
          </Button>
        </div>
      </div>
    </>
  );
}
