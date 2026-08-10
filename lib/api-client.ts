import { authClient } from "./auth-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!; // e.g. http://localhost:8000

/**
 * Fetch wrapper for calls to the FastAPI backend.
 * Pulls a fresh JWT from Better-Auth's jwt plugin and sends it as a Bearer token,
 * so FastAPI can verify the request without ever touching the session cookie.
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: token } = await authClient.token();

  if (!token) {
    throw new Error("Not authenticated — no session token available");
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Backend request failed (${res.status}): ${body}`);
  }

  return res.json();
}