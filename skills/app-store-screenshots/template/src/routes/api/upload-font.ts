import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { rejectCrossSiteWrite, sniffFontType } from "@/lib/request-guard";

const FONT_DIR_REL = path.join("public", "fonts", "imported");
const PUBLIC_PREFIX = "/fonts/imported";
const MAX_BYTES = 16 * 1024 * 1024;

const MIME_EXT: Record<string, { ext: string; format: string }> = {
  "font/woff2": { ext: "woff2", format: "woff2" },
  "font/woff": { ext: "woff", format: "woff" },
  "font/ttf": { ext: "ttf", format: "truetype" },
  "font/otf": { ext: "otf", format: "opentype" },
};

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const bytes = Buffer.from(m[2], "base64");
  return { mime, bytes };
}

export const Route = createFileRoute("/api/upload-font")({
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
        if (parsed.bytes.byteLength > MAX_BYTES) {
          return Response.json({ ok: false, error: "Font file is too large (16MB maximum)." }, { status: 413 });
        }

        // The declared MIME comes from the caller-written data URL, so the
        // stored bytes must actually be that font type.
        const sniffed = sniffFontType(parsed.bytes);
        const fontType = sniffed ? MIME_EXT[sniffed] : undefined;
        if (!fontType) {
          return Response.json(
            { ok: false, error: "Use a WOFF2, WOFF, TTF, or OTF font file." },
            { status: 400 },
          );
        }

        const hash = createHash("sha1").update(parsed.bytes).digest("hex").slice(0, 16);
        const filename = `${hash}.${fontType.ext}`;
        const absDir = path.join(process.cwd(), FONT_DIR_REL);
        const absFile = path.join(absDir, filename);

        try {
          await fs.mkdir(absDir, { recursive: true });
          try {
            await fs.access(absFile);
          } catch {
            await fs.writeFile(absFile, parsed.bytes);
          }
          return Response.json({
            ok: true,
            font: { src: `${PUBLIC_PREFIX}/${filename}`, format: fontType.format },
          });
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
