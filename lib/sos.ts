export const HEALTH_FIELDS = [
  ["age", "Age"],
  ["chronicIllnesses", "Conditions"],
  ["allergies", "Allergies"],
  ["currentMedications", "Medications"],
] as const;
export type HealthField = (typeof HEALTH_FIELDS)[number][0];
export interface SosLocation {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
}
export interface SosIncident {
  incidentId: string;
  recipient: string;
  contactName: string;
  createdAt: string;
  lastAttemptAt: string;
  statusAt: string;
  endedAt: string | null;
  emailStatus: "sending" | "accepted" | "failed" | "unknown";
  attempts: number;
  location: SosLocation | null;
  manualLocation: string;
  sharedFields: HealthField[];
}
export interface SosPreview {
  recipient: string;
  contactName: string;
  message: string;
  previewHash: string;
  consentHash?: string;
  emailReady: boolean;
}
export const EMAIL_STATUS = {
  sending: "Submitting email…",
  accepted: "Accepted by Gmail",
  failed: "Email submission failed",
  unknown: "Email submission unconfirmed",
};
export function contactPhone(value: string) {
  const normalized = value.replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(normalized) ? normalized.slice(1) : null;
}
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

export interface SosQuickPreferences {
  enabled: boolean;
  shareLocation: boolean;
  fields: HealthField[];
  recipient: string;
  contactName: string;
  senderReady: boolean;
}
