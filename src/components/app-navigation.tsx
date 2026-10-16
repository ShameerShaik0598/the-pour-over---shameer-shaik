import Link from "next/link";

const links = [["Overview", "/app"], ["Lookup", "/app/lookup"], ["Segments", "/app/segments"], ["Live", "/app/live"], ["Ask", "/app/assistant"]] as const;

export function AppNavigation() {
  return <nav aria-label="Main navigation" className="page-shell flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-3 text-sm">
    {links.map(([label, href]) => <Link key={href} href={href} className="min-h-10 inline-flex items-center">{label}</Link>)}
    <Link href="/app/data-quality" className="min-h-10 inline-flex items-center">Data quality</Link>
    <form action="/api/auth/logout" method="post" className="ml-auto"><button className="min-h-10 underline">Sign out</button></form>
  </nav>;
}
