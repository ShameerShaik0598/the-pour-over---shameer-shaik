import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Masthead } from "@/components/ui";
import { AppNavigation } from "@/components/app-navigation";
import { readSession, sessionCookieName } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOverviewData } from "@/lib/dashboard";
import { OverviewDashboard } from "./overview-dashboard";

export default async function OverviewPage() {
  const session = await readSession((await cookies()).get(sessionCookieName)?.value);
  if (!session) redirect("/login");
  const data = await getOverviewData(db);
  return <main id="main"><Masthead /><AppNavigation /><OverviewDashboard data={data} defaultCost={Number(process.env.COST_PER_SUBSCRIBER_MONTH ?? 0.2)} /></main>;
}
