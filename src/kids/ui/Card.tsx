import type { HTMLAttributes, ReactNode } from 'react';

/** A cream card with a solid toy edge. */
export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div className={`k-card ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}
