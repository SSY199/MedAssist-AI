"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, db } from "@/lib/auth";

export interface PatientProfileInput {
  age: number;
  gender: string;
  chronicIllnesses: string[];
  pastMedicalIncidents: string;
  currentMedications: string[];
  allergies: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
}

/**
 * Upserts the caller's EHR profile. Used by:
 * - /onboarding (first save, redirects to /dashboard)
 * - /profile (edits, redirects back to /profile with a confirmation)
 */
export async function saveProfile(
  input: PatientProfileInput,
  redirectTo: string = "/dashboard"
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  await db.collection("patientProfiles").updateOne(
    { userId: session.user.id },
    {
      $set: {
        ...input,
        userId: session.user.id,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  redirect(redirectTo);
}

/** Reads the caller's EHR profile, or null if they haven't saved one yet. */
export async function getMyProfile(): Promise<PatientProfileInput | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const profile = await db
    .collection("patientProfiles")
    .findOne({ userId: session.user.id });

  if (!profile) return null;

  return {
    age: profile.age,
    gender: profile.gender,
    chronicIllnesses: profile.chronicIllnesses ?? [],
    pastMedicalIncidents: profile.pastMedicalIncidents ?? "",
    currentMedications: profile.currentMedications ?? [],
    allergies: profile.allergies ?? [],
    emergencyContactName: profile.emergencyContactName ?? "",
    emergencyContactPhone: profile.emergencyContactPhone ?? "",
  };
}