import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { rejectCrossSiteWrite, sniffImageType } from "@/lib/request-guard";

const UPLOAD_DIR_REL = path.join("public", "screenshots", "uploaded");
const PUBLIC_PREFIX = "/screenshots/uploaded";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const bytes = Buffer.from(m[2], "base64");
  return { mime, bytes };
}

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // This route WRITES A FILE to disk. See lib/request-guard.ts.
        const blocked = rejectCrossSiteWrite(request);
        if (blocked) {
          return Response.json({ ok: false, error: blocked.error }, { status: blocked.status });
        }

        let body: { dataUrl?: string };
        try {
          body = (await request.json()) as { dataUrl?: string };
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
        }
        if (!body?.dataUrl || typeof body.dataUrl !== "string") {
          return Response.json({ ok: false, error: "Missing dataUrl" }, { status: 400 });
        }
        const parsed = parseDataUrl(body.dataUrl);
        if (!parsed) {
          return Response.json({ ok: false, error: "Unsupported data URL" }, { status: 400 });
        }
        const ext = MIME_EXT[parsed.mime];
        if (!ext) {
          return Response.json(
            { ok: false, error: `Unsupported mime: ${parsed.mime}` },
            { status: 400 },
          );
        }

        // The declared MIME comes from the caller-written data URL, so it
        // decides the stored extension. Require the bytes to actually be
        // that image type.
        const sniffed = sniffImageType(parsed.bytes);
        if (!sniffed || MIME_EXT[sniffed] !== ext) {
          return Response.json(
            { ok: false, error: "Content does not match declared image type" },
            { status: 400 },
          );
        }

        if (parsed.bytes.byteLength > 8 * 1024 * 1024) {
          return Response.json({ ok: false, error: "Image too large (>8MB)" }, { status: 413 });
        }

        const hash = createHash("sha1").update(parsed.bytes).digest("hex").slice(0, 16);
        const filename = `${hash}.${ext}`;
        const absDir = path.join(process.cwd(), UPLOAD_DIR_REL);
        const absFile = path.join(absDir, filename);

        try {
          await fs.mkdir(absDir, { recursive: true });
          try {
            await fs.access(absFile);
          } catch {
            await fs.writeFile(absFile, parsed.bytes);
          }
          return Response.json({ ok: true, path: `${PUBLIC_PREFIX}/${filename}` });
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
