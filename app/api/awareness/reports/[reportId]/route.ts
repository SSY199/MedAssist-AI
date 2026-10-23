import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { fetchReportPdf } from "@/lib/outbreak-reports";
import { getOutbreakArchive } from "@/lib/outbreak-archive-server";
import { reportIdentity } from "@/lib/outbreak-archive";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return new Response("Sign in to read this report.", { status: 401 });
  const { reportId } = await params;
  const identity = reportIdentity(reportId);
  if (!identity) return new Response("Invalid report ID.", { status: 404 });
  try {
    const report = (await getOutbreakArchive(identity.year)).reports.find(
      (report) => report.id === reportId,
    );
    if (!report)
      return new Response("Report is not in the official listing.", {
        status: 404,
      });
    const bytes = await fetchReportPdf(report);
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${report.id}.pdf"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; frame-ancestors 'self'; sandbox",
      },
    });
  } catch {
    return new Response(
      "The official report is unavailable. Please retry shortly.",
      { status: 502 },
    );
  }
}
