import { notFound } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import { Masthead } from "@/components/ui";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { ProfileView } from "./profile-view";

export default async function ProfilePage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (type !== "subscriber" && type !== "app" && type !== "visitor") notFound();
  if (type === "subscriber" && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if ((type === "app" || type === "visitor") && !/^[a-f0-9]{64}$/i.test(id)) notFound();
  const profile = await getProfile(db, type, id);
  if (!profile) notFound();
  return <main id="main"><Masthead title="Reader profile" /><AppNavigation /><ProfileView profile={profile} /></main>;
}
