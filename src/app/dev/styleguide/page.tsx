import { DataTable, EmptyState, FilterChip, Masthead, Skeleton, SourceChip, StatFigure, Toast } from "@/components/ui";

export default function StyleguidePage() {
  return <main id="main"><Masthead title="Styleguide"/><div className="page-shell space-y-10 py-8"><StatFigure value="2,900" label="Unified readers"/><div className="flex flex-wrap gap-2"><SourceChip>Instagram</SourceChip><FilterChip>Active readers</FilterChip></div><DataTable><thead><tr><th className="p-3">Preview table</th><th className="p-3">Status</th></tr></thead><tbody><tr><td className="p-3">A sample row</td><td className="p-3">Ready</td></tr></tbody></DataTable><Skeleton className="h-10 max-w-md"/><EmptyState title="Nothing here yet">This is an empty state.</EmptyState><Toast>Saved for your next visit.</Toast></div></main>;
}
