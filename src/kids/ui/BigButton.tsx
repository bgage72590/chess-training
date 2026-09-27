// Chunky "toy" buttons: a solid bottom edge that presses down. Always icon + word (or aria-label).
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { KidsIcon, type KidsIconName } from './KidsIcon';
import { kidSound } from '../lib/kidsSound';

export type ButtonVariant = 'primary' | 'go' | 'info' | 'boss' | 'magic' | 'plain';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  icon?: KidsIconName;
  children?: ReactNode;
  size?: 'normal' | 'small';
  /** Plays the soft whoosh on press. */
  whoosh?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function BigButton({ variant = 'primary', icon, children, size = 'normal', className, whoosh, onClick, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`k-btn k-btn-${variant}${size === 'small' ? ' k-btn-small' : ''}${children ? '' : ' k-btn-icon'} ${className ?? ''}`}
      onClick={(e) => {
        if (whoosh) kidSound('whoosh');
        onClick?.(e);
      }}
      {...rest}
    >
      {icon && <KidsIcon name={icon} size={size === 'small' ? 22 : 28} />}
      {children && <span className="k-btn-label">{children}</span>}
    </button>
  );
}

/** The map's giant PLAY button. */
export function PlayButton({ onClick, label = 'Play!', disabled }: { onClick(): void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" className="k-playbtn" onClick={onClick} disabled={disabled}>
      <KidsIcon name="play" size={40} />
      <span>{label}</span>
    </button>
  );
}
