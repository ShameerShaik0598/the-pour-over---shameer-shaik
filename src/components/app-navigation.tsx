"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [["Overview", "/app"], ["Lookup", "/app/lookup"], ["Segments", "/app/segments"], ["Live", "/app/live"], ["Ask", "/app/assistant"]] as const;

export function AppNavigation() {
  const pathname = usePathname();
  const items = [...links, ["Data quality", "/app/data-quality"] as const];
  return <nav aria-label="Main navigation" className="mast-nav"><div className="page-shell mast-nav-inner">
    <div className="mast-nav-links">{items.map(([label, href]) => {
      const active = href === "/app" ? pathname === href || pathname === "/app/" : pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`mast-nav-link${active ? " is-active" : ""}`}>{label}</Link>;
    })}</div>
    <div className="mast-nav-actions"><form action="/api/auth/logout" method="post"><button className="mast-signout">Sign out</button></form></div>
  </div></nav>;
}
