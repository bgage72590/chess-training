// The Sticker Book: a page of stickers per world (plus Specials), the trophy shelf, and the
// wardrobe for the Pawn Buddy. Tapping an earned sticker reads its fact aloud.
import { useState } from 'react';
import type { KidProfile } from '../store/kidsStore';
import { updateKid } from '../store/kidsStore';
import { MOMENT_STICKERS, STICKERS, stickerDef, trophiesFor, type StickerDef } from '../curriculum/stickers';
import { WORLDS, type WorldId } from '../curriculum/worlds';
import { AVATAR_COLORS, FACES, HATS, type AvatarColor, type FaceId, type HatId } from '../curriculum/wardrobe';
import { totalStars, visibleTo, worldPassed } from '../store/progress';
import { NODE_BY_ID } from '../curriculum/worlds';
import { REGISTRY } from '../packs';
import { StickerSlot } from '../ui/StickerSlot';
import { KidsIcon } from '../ui/KidsIcon';
import { PawnBuddy } from '../ui/PawnBuddy';
import { BuddyFace } from '../ui/BuddyFace';
import type { BuddyId } from '../curriculum/buddies';
import { MapBar } from './MapScreen';
import { sayAs } from '../player/speech';
import { kidSound } from '../lib/kidsSound';
import { go } from '../routes';

type Tab = 'stickers' | 'trophies' | 'wardrobe' | 'scene';
const PAGES: (WorldId | 'special')[] = [...WORLDS.map((w) => w.id), 'special'];

export function StickerBook({ kid, tab }: { kid: KidProfile; tab: Tab }) {
  const [page, setPage] = useState(0);
  const [flipDir, setFlipDir] = useState(1);
  const t: Tab = tab === 'scene' ? 'stickers' : tab;
  const flip = (d: number) => {
    kidSound('whoosh');
    setFlipDir(d);
    setPage((p) => (p + d + PAGES.length) % PAGES.length);
  };
  const readFact = (def: StickerDef) => sayAs(kid, [def.fact], { force: true });
  const pg = PAGES[page];
  const w = WORLDS.find((x) => x.id === pg);
  const pageStickers = pg === 'special' ? [...MOMENT_STICKERS, ...extraEarned(kid)] : STICKERS.filter((s) => s.page === pg && (!s.node || visibleTo(NODE_BY_ID.get(s.node)!, kid.band)));

  return (
    <div className="k-screen k-book">
      <MapBar kid={kid} stars={totalStars(kid)} back={() => go.map()} playgroundOpen={kid.start === 'games' || worldPassed(kid, 'w5', REGISTRY)} />
      <div className="k-tabs" role="tablist" aria-label="Sticker book">
        {(
          [
            ['stickers', 'Stickers', 'star'],
            ['trophies', 'Trophies', 'trophy'],
            ['wardrobe', 'Dress up', 'heart'],
          ] as const
        ).map(([id, label, icon]) => (
          <button key={id} type="button" role="tab" aria-selected={t === id} className={`k-tab${t === id ? ' on' : ''}`} onClick={() => (id === 'stickers' ? go.stickers() : go.stickers(id))}>
            <KidsIcon name={icon} size={24} /> {label}
          </button>
        ))}
      </div>

      {t === 'stickers' && (
        <div className="k-book-page" style={w ? { ['--wbg' as string]: w.bg, ['--acc' as string]: w.accent } : undefined}>
          <div className="k-book-head">
            <button type="button" className="k-round k-round-plain" aria-label="Previous page" onClick={() => flip(-1)}>
              <KidsIcon name="back" size={28} />
            </button>
            <h2 className="k-book-title">{w ? `Rank ${w.rank}: ${w.title}` : 'Specials'}</h2>
            <button type="button" className="k-round k-round-plain" aria-label="Next page" onClick={() => flip(1)}>
              <KidsIcon name="next" size={28} />
            </button>
          </div>
          <div className="k-sticker-grid" key={page} style={{ ['--sx' as string]: flipDir }}>
            {pageStickers.map((s) => (
              <StickerSlot key={s.id} def={s} earned={!!kid.stickers[s.id]} onTap={() => readFact(s)} hint={s.node && !REGISTRY.isRegistered(s.node) ? 'Coming soon' : undefined} />
            ))}
          </div>
          <div className="k-book-dots" aria-hidden="true">
            {PAGES.map((_, i) => (
              <span key={i} className={i === page ? 'on' : ''} />
            ))}
          </div>
        </div>
      )}

      {t === 'trophies' && (
        <div className="k-shelf">
          {trophiesFor(kid.band).map((tr) => {
            const got = !!kid.trophies[tr.id];
            const m = /^tr-beat-(shelly|hop|tuck|fern|olive)$/.exec(tr.id);
            const buddy = m ? (m[1] as BuddyId) : null;
            return (
              <div key={tr.id} className={`k-trophy${got ? ' got' : ''}`} style={{ ['--sc' as string]: tr.color }}>
                <span className="k-trophy-cup">
                  {buddy ? <BuddyFace id={buddy} mood={got ? 'happy' : 'thinking'} size={58} /> : <KidsIcon name={got ? tr.icon : 'lock'} size={40} />}
                </span>
                <span className="k-trophy-title">{tr.title}</span>
                {!got && <span className="k-small">{tr.how}</span>}
              </div>
            );
          })}
        </div>
      )}

      {t === 'wardrobe' && <Wardrobe kid={kid} />}
    </div>
  );
}

function extraEarned(kid: KidProfile): StickerDef[] {
  return Object.keys(kid.stickers)
    .filter((id) => /^st-(garden|family)-\d+$/.test(id))
    .map((id) => stickerDef(id)!)
    .filter(Boolean);
}

function Wardrobe({ kid }: { kid: KidProfile }) {
  const stars = totalStars(kid);
  const set = (fn: (a: KidProfile['avatar']) => void) => {
    kidSound('pop', 2);
    updateKid(kid.id, (d) => fn(d.avatar));
  };
  return (
    <div className="k-wardrobe">
      <div className="k-card k-wardrobe-preview">
        <PawnBuddy color={kid.avatar.color} face={kid.avatar.face} hat={kid.avatar.hat} size={170} className="k-bob" />
        <span className="k-build-name">{kid.name}</span>
      </div>
      <div className="k-card k-wardrobe-pick">
        <p className="k-field-label">Color</p>
        <div className="k-swatches">
          {(Object.keys(AVATAR_COLORS) as AvatarColor[]).map((c) => (
            <button key={c} type="button" className={`k-swatch${kid.avatar.color === c ? ' on' : ''}`} style={{ background: AVATAR_COLORS[c].fill }} aria-label={AVATAR_COLORS[c].label} onClick={() => set((a) => void (a.color = c))} />
          ))}
        </div>
        <p className="k-field-label">Face</p>
        <div className="k-faces">
          {FACES.map((f) => (
            <button key={f.id} type="button" className={`k-facebtn${kid.avatar.face === f.id ? ' on' : ''}`} aria-label={f.label} onClick={() => set((a) => void (a.face = f.id as FaceId))}>
              <PawnBuddy color={kid.avatar.color} face={f.id} size={44} />
            </button>
          ))}
        </div>
        <p className="k-field-label">Hats</p>
        <div className="k-faces">
          <button type="button" className={`k-facebtn${!kid.avatar.hat ? ' on' : ''}`} aria-label="No hat" onClick={() => set((a) => void (a.hat = null))}>
            <KidsIcon name="x" size={26} />
          </button>
          {HATS.map((h) => {
            // Hats come from the star total (tested-out stars count too) or special unlocks.
            const owned = kid.wardrobe.includes(h.id as HatId) || (h.stars != null && stars >= h.stars);
            return owned ? (
              <button key={h.id} type="button" className={`k-facebtn${kid.avatar.hat === h.id ? ' on' : ''}`} aria-label={h.label} onClick={() => set((a) => void (a.hat = h.id))}>
                <PawnBuddy color={kid.avatar.color} face={kid.avatar.face} hat={h.id} size={44} />
              </button>
            ) : (
              <span key={h.id} className="k-facebtn locked" aria-label={`${h.label}: ${h.how}`}>
                <KidsIcon name="lock" size={20} />
                <small>{h.stars ? `${Math.max(0, h.stars - stars)} more` : 'Crown!'}</small>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

