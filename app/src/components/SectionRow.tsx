import type { ReactNode } from "react";

export function SectionRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section-row">
      <h2 className="section-row__title serif">{title}</h2>
      <div className="section-row__scroller">{children}</div>
    </section>
  );
}
