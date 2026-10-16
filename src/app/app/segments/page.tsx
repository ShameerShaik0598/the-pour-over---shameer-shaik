import { AppNavigation } from "@/components/app-navigation";
import { Masthead } from "@/components/ui";
import { SegmentBuilder } from "./segment-builder";

export default function SegmentsPage() {
  return <main id="main"><Masthead title="Build a segment" /><AppNavigation /><div className="page-shell py-9"><p className="section-label">GROWTH DESK · SEGMENTS</p><h2 className="mt-2 font-display text-4xl">A clear audience, on purpose.</h2><p className="mt-3 max-w-2xl text-ink-muted">Combine the newsletter and activity facts. Preview updates as filters change; saved segments export as spreadsheet-safe CSV.</p><SegmentBuilder /></div></main>;
}
