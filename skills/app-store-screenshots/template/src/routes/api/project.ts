import { promises as fs } from "node:fs";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { rejectCrossSiteWrite } from "@/lib/request-guard";

const PROJECT_FILE = "app-store-screenshots.json";

function filePath() {
  return path.join(process.cwd(), PROJECT_FILE);
}

export const Route = createFileRoute("/api/project")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const raw = await fs.readFile(filePath(), "utf8");
          const parsed = JSON.parse(raw);
          return Response.json({ ok: true, state: parsed });
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code;
          if (code === "ENOENT") {
            return Response.json({ ok: true, state: null });
          }
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      POST: async ({ request }) => {
        // This route OVERWRITES a git-tracked file. See lib/request-guard.ts.
        const blocked = rejectCrossSiteWrite(request);
        if (blocked) {
          return Response.json({ ok: false, error: blocked.error }, { status: blocked.status });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
        }
        try {
          const pretty = JSON.stringify(body, null, 2) + "\n";
          await fs.writeFile(filePath(), pretty, "utf8");
          return Response.json({ ok: true });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
