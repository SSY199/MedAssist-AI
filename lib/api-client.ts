import { authClient } from "./auth-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

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

/**
 * Like apiFetch, but returns the raw ReadableStream body instead of parsing
 * JSON — for endpoints that respond with text/event-stream (SSE). Used by
 * the chat streaming endpoint. Caller is responsible for reading and
 * parsing the stream.
 */
export async function apiFetchStream(path: string, options: RequestInit = {}) {
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

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`Backend request failed (${res.status}): ${body}`);
  }

  return res.body;
}