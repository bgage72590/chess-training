// A sticker: full color with an ink outline and a ribbon title when earned; a soft silhouette
// with "Play <node>!" when not. Tapping an earned sticker reads its fact aloud.
import type { StickerDef } from '../curriculum/stickers';
import { KidsIcon } from './KidsIcon';

export function StickerArt({ def, size = 96 }: { def: StickerDef; size?: number }) {
  return (
    <span className={`k-sticker-art${def.shiny ? ' shiny' : ''}`} style={{ width: size, height: size, ['--sc' as string]: def.art.color }}>
      {def.art.piece ? <span className={`k-sticker-piece pc-w${def.art.piece.toUpperCase()}`} aria-hidden="true" /> : <KidsIcon name={def.art.icon ?? 'star'} size={Math.round(size * 0.46)} />}
    </span>
  );
}

export function StickerSlot({ def, earned, onTap, hint }: { def: StickerDef; earned: boolean; onTap?: () => void; hint?: string }) {
  if (!earned)
    return (
      <div className="k-sticker missing" role="img" aria-label={`Not yet: ${hint ?? def.title}`}>
        <span className="k-sticker-art ghost">
          {def.art.piece ? <span className={`k-sticker-piece pc-w${def.art.piece.toUpperCase()}`} aria-hidden="true" /> : <KidsIcon name={def.art.icon ?? 'star'} size={40} />}
        </span>
        {/* A node sticker says which game earns it; a special one is a moment to find, so it just names it. */}
        <span className="k-sticker-title">{hint ?? (def.page === 'special' ? def.title : `Play ${def.title.replace(/[!?.]$/, '')}!`)}</span>
      </div>
    );
  return (
    <button type="button" className="k-sticker earned" onClick={onTap} aria-label={`${def.title}. ${def.fact}`}>
      <StickerArt def={def} />
      <span className="k-sticker-ribbon">{def.title}</span>
    </button>
  );
}
