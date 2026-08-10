import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, db } from "@/lib/auth";

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const { next } = await searchParams;
  const destination = next || "/dashboard";

  // "patientProfiles" is the app-specific EHR collection, separate from
  // Better-Auth's own user/session/account collections. userId links back
  // to session.user.id.
  const profile = await db
    .collection("patientProfiles")
    .findOne({ userId: session.user.id });

  if (!profile) {
    redirect("/onboarding");
  }

  redirect(destination);
}