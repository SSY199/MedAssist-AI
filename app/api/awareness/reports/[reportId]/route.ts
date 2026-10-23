import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import catalog from "@/backend/app/data/awareness.json";
import { fetchReportPdf, reviewedReport } from "@/lib/outbreak-reports";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return new Response("Sign in to read this report.", { status: 401 });
  const { reportId } = await params;
  const report = reviewedReport(catalog.weeklyReports, reportId);
  if (!report)
    return new Response("Report not in the reviewed collection.", {
      status: 404,
    });
  try {
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
