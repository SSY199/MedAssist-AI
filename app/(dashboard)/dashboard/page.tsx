import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getMyProfile } from "@/lib/profile-actions";
import AwarenessHome from "@/components/AwarenessHome";
import awarenessData from "@/backend/app/data/awareness.json";
import type { AwarenessCatalog } from "@/lib/awareness";

const catalog: AwarenessCatalog = awarenessData;

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const profile = await getMyProfile();
  return (
    <AwarenessHome
      catalog={catalog}
      firstName={session?.user.name?.split(" ")[0] ?? "there"}
      profileReady={Boolean(profile)}
    />
  );
}
