import type { ReactNode } from 'react';

/** Section title in the personal-site style: mono "// label" eyebrow above the heading. */
export function Heading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="heading">
      <p className="eyebrow" aria-hidden="true">
        // {label}
      </p>
      <h2>{children}</h2>
    </div>
  );
}
