import "server-only";
import catalog from "@/backend/app/data/awareness.json";
import { createArchiveLoader } from "@/lib/outbreak-archive";

// Small per-process cache. Restarts/serverless instances may re-fetch independently.
export const getOutbreakArchive = createArchiveLoader(catalog.weeklyReports);
