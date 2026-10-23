import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getOutbreakArchive } from "@/lib/outbreak-archive-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return Response.json(
      { error: "Sign in to read the archive" },
      { status: 401 },
    );
  const raw = request.nextUrl.searchParams.get("year");
  const year = raw === null ? undefined : Number(raw);
  if (
    raw !== null &&
    (!/^20\d{2}$/.test(raw) || year! > new Date().getUTCFullYear())
  )
    return Response.json({ error: "Invalid year" }, { status: 400 });
  try {
    return Response.json(await getOutbreakArchive(year), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "Official archive unavailable for this year. Retry shortly." },
      { status: 503 },
    );
  }
}
