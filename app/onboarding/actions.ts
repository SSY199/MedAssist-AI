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

export async function saveProfile(input: PatientProfileInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // upsert: creates the doc on first save, updates it on every later edit —
  // same action can power onboarding AND a future "edit profile" screen.
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

  redirect("/dashboard");
}