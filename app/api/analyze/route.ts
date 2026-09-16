import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { analyzeRequirements, draftAnalysisReport } from "@/lib/llm";

const MAX_BYTES = 2_000_000; // ~2MB of text is far beyond any sane requirement doc

/**
 * Accepts either JSON { rawText } or multipart/form-data with `file` (and an
 * optional `text` field for pasted content). Text extraction supports .txt /
 * .md / plain text directly; .docx and PDFs are decoded best-effort (docx is a
 * zip of XML — the raw <w:t> text runs are pulled out; PDFs contribute their
 * text objects). Whatever text is recovered feeds BOTH the structured
 * extraction AND the simplified report draft in one round trip.
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";
  let rawText = "";
  const attachments: { name: string; size: number; type: string }[] = [];

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const pasted = form.get("text");
      if (typeof pasted === "string") rawText += pasted;

      for (const entry of form.getAll("file")) {
        if (!(entry instanceof File)) continue;
        if (entry.size > MAX_BYTES) {
          return NextResponse.json({ error: `${entry.name} is too large (2MB limit)` }, { status: 400 });
        }
        const buf = Buffer.from(await entry.arrayBuffer());
        const name = entry.name.toLowerCase();
        let text = "";
        if (name.endsWith(".docx")) {
          // DOCX = zip whose word/document.xml holds the text in <w:t> runs.
          const xml = extractDocxXml(buf);
          text = xml
            .replace(/<w:p[ >]/g, "\n<w:p ")
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
        } else if (name.endsWith(".pdf")) {
          text = extractPdfText(buf);
        } else {
          // .txt, .md, .rtf(ish), any plain text
          text = buf.toString("utf8");
        }
        const cleaned = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
        if (cleaned) {
          rawText += (rawText ? "\n\n" : "") + `--- ${entry.name} ---\n${cleaned}`;
          attachments.push({ name: entry.name, size: entry.size, type: entry.type || "application/octet-stream" });
        }
      }
    } else {
      const body = await req.json().catch(() => null);
      rawText = typeof body?.rawText === "string" ? body.rawText : "";
    }
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded file(s)" }, { status: 400 });
  }

  if (!rawText.trim()) {
    return NextResponse.json(
      { error: "Attach a file (.txt, .md, .docx, .pdf) or paste the requirement document first" },
      { status: 400 }
    );
  }
  if (rawText.length > 400_000) {
    return NextResponse.json({ error: "Combined document text too long (400k character limit)" }, { status: 400 });
  }

  const extracted = await analyzeRequirements(rawText);
  const report = await draftAnalysisReport(rawText, extracted);
  return NextResponse.json({ extracted, report, attachments });
}

/** Pull word/document.xml out of a DOCX zip (stored or deflated entries). */
function extractDocxXml(buf: Buffer): string {
  // End of central directory record lives in the last ~64KB.
  const tail = buf.subarray(Math.max(0, buf.length - 65_536));
  const eocd = tail.lastIndexOf("PK\x05\x06");
  if (eocd === -1) return "";
  const eocdAbs = buf.length - tail.length + eocd;
  const entries = tail.readUInt16LE(eocdAbs + 10);
  let ptr = tail.indexOf("PK\x01\x02"); // central directory start
  for (let i = 0; i < entries && ptr !== -1 && ptr + 46 <= tail.length; i++) {
    const method = tail.readUInt16LE(ptr + 10);
    const compSize = tail.readUInt32LE(ptr + 20);
    const nameLen = tail.readUInt16LE(ptr + 28);
    const extraLen = tail.readUInt16LE(ptr + 30);
    const commentLen = tail.readUInt16LE(ptr + 32);
    const localOff = tail.readUInt32LE(ptr + 42);
    const name = tail.subarray(ptr + 46, ptr + 46 + nameLen).toString("utf8");
    if (name === "word/document.xml") {
      const lfhLen = 30 + tail.readUInt16LE(localOff + 26) + tail.readUInt16LE(localOff + 28);
      const data = buf.subarray(localOff + lfhLen, localOff + lfhLen + compSize);
      const xml = method === 8 ? inflateSync(data) : data.toString("utf8");
      return xml;
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return "";
}

function inflateSync(data: Buffer): string {
  // Raw DEFLATE → use Node zlib (route runs on the Node runtime).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zlib = require("zlib") as typeof import("zlib");
  return zlib.inflateRawSync(data).toString("utf8");
}

/** Minimal PDF text extraction: decompress FlateDecode streams, pull text in Tj/TJ operators. */
function extractPdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const chunks: string[] = [];
  // Decompress all FlateDecode streams (zlib header 0x78 usually present).
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zlib = require("zlib") as typeof import("zlib");
  while ((m = streamRe.exec(raw)) !== null) {
    const streamBuf = Buffer.from(m[1], "latin1");
    try {
      chunks.push(zlib.inflateSync(streamBuf).toString("latin1"));
    } catch {
      try {
        chunks.push(zlib.inflateRawSync(streamBuf).toString("latin1"));
      } catch {
        /* not deflate — skip */
      }
    }
  }
  const content = chunks.join("\n") || raw;
  const texts: string[] = [];
  const tjRe = /\((?:\\.|[^\\()])*\)/g;
  let t: RegExpExecArray | null;
  while ((t = tjRe.exec(content)) !== null) {
    const s = t[0].slice(1, -1).replace(/\\([()\\])/g, "$1").replace(/\\[rn]/g, " ");
    if (s.trim()) texts.push(s);
  }
  return texts.join(" ");
}
