import './install.css';
import { APP_URL } from '../pwa/install';
import { toast } from '../lib/toast';
import { Button } from './ui';
import { QrCode } from './QrCode';
import { APP_ADDRESS } from './InstallCard';

/** What is handed on: always the app's own address. The page being viewed may be a sync link, and
 *  its address holds a private sync code. */
export const SHARE = {
  title: 'Tempo Chess Gym',
  text: 'Tempo: chess lessons, rated puzzles and games against Stockfish.',
  url: APP_URL,
};

/** Opens the device's share sheet; a person closing it without sharing is not an error. */
export async function shareApp(nav: Pick<Navigator, 'share'>): Promise<void> {
  try {
    await nav.share({ ...SHARE });
  } catch {
    /* closed, or sharing is not allowed here */
  }
}

export async function copyAppLink() {
  try {
    await navigator.clipboard.writeText(SHARE.url);
    toast({ title: 'Link copied', icon: 'check', tone: 'good' });
  } catch {
    toast({ title: 'Copy blocked', body: 'Select the address and copy it by hand.', icon: 'x', tone: 'bad' });
  }
}

/** Settings: hand Tempo to someone else with a QR code, a link and the share sheet. */
export function ShareCard() {
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <section className="card settings-section ig-share">
      <h2>Share Tempo</h2>
      <p className="muted">Show this code to a friend or family member, or send them the link. They open it in their browser and can install Tempo from there. Nothing of yours goes with it.</p>
      <div className="ig-share-body">
        <QrCode text={SHARE.url} label="QR code for the Tempo web address" />
        <div className="ig-share-side">
          <span className="mono app-address">{APP_ADDRESS}</span>
          <div className="btn-row">
            <Button size="s" onClick={() => void copyAppLink()}>
              Copy link
            </Button>
            {canShare && (
              <Button size="s" variant="ghost" onClick={() => void shareApp(navigator)}>
                Share
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
