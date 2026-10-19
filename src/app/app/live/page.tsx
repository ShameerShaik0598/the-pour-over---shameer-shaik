import { AppNavigation } from "@/components/app-navigation";
import { Masthead } from "@/components/ui";
import { LiveFeed } from "./live-feed";

export default function LivePage() {
  return <main id="main"><Masthead title="Live" /><AppNavigation /><div className="page-shell live-page py-9"><p className="section-label">APP ACTIVITY · REFRESHES EVERY 2 SECONDS</p><h2 className="mt-2 font-display text-4xl">Events as they arrive.</h2><p className="mt-3 max-w-2xl text-ink-muted">Event details are shown without exposing device or user identifiers in the feed.</p><LiveFeed /></div></main>;
}
