import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL, // e.g. http://localhost:3000
  plugins: [jwtClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

/**
 * Sign in with Google — call from a "Continue with Google" button.
 * Usage: <button onClick={() => signInWithGoogle()}>Continue with Google</button>
 */
export function signInWithGoogle() {
  return authClient.signIn.social({
    provider: "google",
    callbackURL: "/test-auth",
    //callbackURL: "/dashboard",
  });
}