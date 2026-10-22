import { getMyProfile } from "@/lib/profile-actions";
import { SosPanel } from "@/components/SosPanel";

export default async function SosPage() {
  const profile = await getMyProfile();
  return <SosPanel profile={profile} />;
}
