import MedicationReminders from "@/components/MedicationReminders";
import { getMyProfile } from "@/lib/profile-actions";

export default async function RemindersPage() {
  const profile = await getMyProfile();
  return (
    <MedicationReminders profileNames={profile?.currentMedications ?? []} />
  );
}
