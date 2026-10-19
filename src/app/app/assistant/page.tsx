import { AppNavigation } from "@/components/app-navigation";
import { Masthead } from "@/components/ui";
import { AssistantChat } from "./assistant-chat";

export default function AssistantPage() {
  return <main id="main"><Masthead title="Ask" /><AppNavigation /><div className="page-shell assistant-page py-9"><p className="section-label">GROWTH DESK · ASSISTANT</p><h2 className="mt-2 font-display text-4xl">A question, answered with a plan.</h2><p className="mt-3 max-w-2xl text-ink-muted">The model sees only your redacted question and a fixed filter schema. Carafe runs the validated plan against the local reader facts and writes the answer here.</p><AssistantChat /></div></main>;
}
