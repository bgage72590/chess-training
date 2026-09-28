import type { HTMLAttributes, ReactNode } from 'react';

/** A cream card with a solid toy edge. With an onClick it squishes when pressed. */
export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div className={`k-card${rest.onClick ? ' k-card-tap' : ''} ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}
