import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { MongoClient } from "mongodb";

// Reuse a single MongoClient across hot reloads in dev
const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };

const client =
  globalForMongo.mongoClient ?? new MongoClient(process.env.MONGODB_URI!);

if (process.env.NODE_ENV !== "production") {
  globalForMongo.mongoClient = client;
}

// Better-Auth manages its own collections here: user, session, account, verification.
// Keep your app-specific EHR profile in a SEPARATE collection (e.g. "patientProfiles"),
// linked by the user's _id — don't extend Better-Auth's user schema directly.
const db = client.db(process.env.MONGODB_DB_NAME!);

export const auth = betterAuth({
  database: mongodbAdapter(db),

  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,

  trustedOrigins: [
    "http://localhost:3000",
    "http://192.168.0.102:3000" // Handles requests when testing on your local network
  ],

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  // Issues short-lived JWTs (via /api/auth/token) that FastAPI verifies
  // independently against the JWKS endpoint below — no shared secret needed.
  plugins: [jwt()],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
  },
});

export type Session = typeof auth.$Infer.Session;