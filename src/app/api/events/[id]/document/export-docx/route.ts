import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { requireEventAccess } from "@/lib/auth/guards";
import { EventProjectBriefData } from "@/lib/proposal/export-proposal-word";
import { applyBriefDataToDocumentXml } from "@/lib/proposal/docx-xml-builder";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_DOCX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB safe ceiling under Vercel 4.5MB limit

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  noStore();

  const access = await requireEventAccess(context.params.id);
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status }
    );
  }

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_DOCX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "Ukuran data dokumen melebihi batas maksimal 2MB." },
        { status: 413 }
      );
    }

    const data = JSON.parse(rawBody) as EventProjectBriefData;
    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      "event-project-brief-template.docx"
    );
    const fileBuf = await fs.readFile(templatePath);
    const zip = await JSZip.loadAsync(fileBuf);
    const docFile = zip.file("word/document.xml");
    if (!docFile) {
      return NextResponse.json(
        { success: false, error: "Template DOCX tidak valid (document.xml hilang)" },
        { status: 500 }
      );
    }

    const originalXml = await docFile.async("string");
    const docXml = applyBriefDataToDocumentXml(originalXml, data);

    zip.file("word/document.xml", docXml);
    const outBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const safeFilename = `${(data.eventName || "Event-Project-Brief")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")}-Brief.docx`;

    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal mengekspor file Word (.docx)",
      },
      { status: 500 }
    );
  }
}
