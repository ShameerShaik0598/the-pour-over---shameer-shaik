import type { ReactNode } from "react";

export function Masthead({ title = "Carafe", eyebrow = "THE POUR OVER · READER EDITION" }: { title?: string; eyebrow?: string }) {
  return <header className="masthead"><div className="page-shell flex items-end justify-between gap-4"><div><p className="section-label">{eyebrow}</p><h1 className="font-display text-3xl sm:text-4xl">{title}</h1></div><time className="section-label hidden sm:block" dateTime="2026-09-28">Monday, September 28, 2026</time></div></header>;
}

export function StatFigure({ value, label }: { value: string | number; label: string }) {
  return <section className="border-t border-line pt-4"><div className="stat-figure">{value}</div><p className="mt-2 text-sm text-ink-muted">{label}</p></section>;
}

export function SourceChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-sm border border-line px-2 py-1 text-xs">{children}</span>;
}

export function DataTable({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto border-y border-line"><table className="w-full text-left text-sm">{children}</table></div>;
}

export function FilterChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex min-h-9 items-center border border-line bg-paper-2 px-3 text-sm">{children}</span>;
}

export function Skeleton({ className = "h-5 w-full" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded bg-paper-2 ${className}`} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <section className="border border-dashed border-line p-6"><h2 className="font-display text-2xl">{title}</h2>{children && <p className="mt-2 text-sm text-ink-muted">{children}</p>}</section>;
}

export function Toast({ children }: { children: ReactNode }) {
  return <p role="status" className="border-l-2 border-accent-strong bg-paper-2 px-4 py-3 text-sm">{children}</p>;
}
