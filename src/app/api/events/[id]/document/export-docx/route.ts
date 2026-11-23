import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  EventProjectBriefData,
  resolveTechnicalSections,
} from "@/lib/proposal/export-proposal-word";

function escapeXml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatXmlRunsText(value: string): string {
  const safe = String(value ?? "");
  if (!safe.includes("\n")) {
    return escapeXml(safe);
  }
  return safe
    .split("\n")
    .map((line) => escapeXml(line))
    .join("</w:t><w:br/><w:t xml:space=\"preserve\">");
}

function formatRupiahDisplay(amount: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)}`;
}

/**
 * Replaces the text of a single <w:t> node (either index 0 or last) inside an XML block.
 */
function replaceCellText(cellXml: string, newText: string, wtIndex: "first" | "last" = "last"): string {
  const matches = Array.from(cellXml.matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g));
  if (matches.length === 0) {
    // Cell had an empty run without <w:t/>, inject inside last </w:r> or </w:p>
    const encoded = `<w:t xml:space="preserve">${formatXmlRunsText(newText)}</w:t>`;
    if (cellXml.includes("</w:rPr>")) {
      return cellXml.replace("</w:rPr>", `</w:rPr>${encoded}`);
    }
    return cellXml.replace("</w:p>", `<w:r>${encoded}</w:r></w:p>`);
  }

  const targetMatch = wtIndex === "first" ? matches[0] : matches[matches.length - 1];
  const fullTag = targetMatch[0];
  const replacementTag = `<w:t xml:space="preserve">${formatXmlRunsText(newText)}</w:t>`;
  const idx = targetMatch.index!;
  return cellXml.slice(0, idx) + replacementTag + cellXml.slice(idx + fullTag.length);
}

/**
 * Finds all top-level <w:tbl>...</w:tbl> segments (ignoring nested complexity).
 */
interface SpanRange {
  start: number;
  end: number;
  xml: string;
}

function extractTopLevelBlocks(bodyXml: string, tagName: "w:tbl"): SpanRange[] {
  const results: SpanRange[] = [];
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let cursor = 0;

  while (cursor < bodyXml.length) {
    const start = bodyXml.indexOf(openTag, cursor);
    if (start === -1) break;
    // Check next char is space or >
    const nextChar = bodyXml[start + openTag.length];
    if (nextChar !== " " && nextChar !== ">") {
      cursor = start + openTag.length;
      continue;
    }

    let depth = 1;
    let scan = start + openTag.length;
    while (depth > 0 && scan < bodyXml.length) {
      const nextOpen = bodyXml.indexOf(openTag, scan);
      const nextClose = bodyXml.indexOf(closeTag, scan);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        const ch = bodyXml[nextOpen + openTag.length];
        if (ch === " " || ch === ">") depth++;
        scan = nextOpen + openTag.length;
      } else {
        depth--;
        scan = nextClose + closeTag.length;
      }
    }
    results.push({ start, end: scan, xml: bodyXml.slice(start, scan) });
    cursor = scan;
  }
  return results;
}

function splitTableParts(tblXml: string): { prefix: string; rows: string[]; suffix: string } {
  const rowRanges: SpanRange[] = [];
  const openTag = "<w:tr";
  const closeTag = "</w:tr>";
  let cursor = 0;

  while (cursor < tblXml.length) {
    const start = tblXml.indexOf(openTag, cursor);
    if (start === -1) break;
    const nextCh = tblXml[start + openTag.length];
    if (nextCh !== " " && nextCh !== ">") {
      cursor = start + openTag.length;
      continue;
    }
    const closeIdx = tblXml.indexOf(closeTag, start);
    if (closeIdx === -1) break;
    const end = closeIdx + closeTag.length;
    rowRanges.push({ start, end, xml: tblXml.slice(start, end) });
    cursor = end;
  }

  if (rowRanges.length === 0) {
    return { prefix: tblXml, rows: [], suffix: "" };
  }

  return {
    prefix: tblXml.slice(0, rowRanges[0].start),
    rows: rowRanges.map((r) => r.xml),
    suffix: tblXml.slice(rowRanges[rowRanges.length - 1].end),
  };
}

function splitRowCells(trXml: string): { prefix: string; cells: string[]; suffix: string } {
  const cellRanges: SpanRange[] = [];
  const openTag = "<w:tc";
  const closeTag = "</w:tc>";
  let cursor = 0;

  while (cursor < trXml.length) {
    const start = trXml.indexOf(openTag, cursor);
    if (start === -1) break;
    const nextCh = trXml[start + openTag.length];
    if (nextCh !== " " && nextCh !== ">") {
      cursor = start + openTag.length;
      continue;
    }
    const closeIdx = trXml.indexOf(closeTag, start);
    if (closeIdx === -1) break;
    const end = closeIdx + closeTag.length;
    cellRanges.push({ start, end, xml: trXml.slice(start, end) });
    cursor = end;
  }

  if (cellRanges.length === 0) {
    return { prefix: trXml, cells: [], suffix: "" };
  }

  return {
    prefix: trXml.slice(0, cellRanges[0].start),
    cells: cellRanges.map((c) => c.xml),
    suffix: trXml.slice(cellRanges[cellRanges.length - 1].end),
  };
}

function populateRowCells(trXml: string, values: string[], wtIndex: "first" | "last" = "last"): string {
  const { prefix, cells, suffix } = splitRowCells(trXml);
  const updated = cells.map((cell, idx) =>
    idx < values.length ? replaceCellText(cell, values[idx], wtIndex) : cell
  );
  return `${prefix}${updated.join("")}${suffix}`;
}

function buildDynamicListTable(
  tblXml: string,
  items: string[][],
  hasFooterRow = false
): string {
  const { prefix, rows, suffix } = splitTableParts(tblXml);
  if (rows.length < 2) return tblXml;

  const headerRow = rows[0];
  const templateDataRow = rows[1];
  const footerRow = hasFooterRow ? rows[rows.length - 1] : null;

  const targetRows = items.length > 0 ? items : [["—", "Belum ada data", "", "", ""]];
  const builtDataRows = targetRows.map((rowValues) =>
    populateRowCells(templateDataRow, rowValues, "last")
  );

  return `${prefix}${headerRow}${builtDataRows.join("")}${footerRow ?? ""}${suffix}`;
}

function buildBudgetDetailOoxmlBlock(data: EventProjectBriefData): string {
  const items = data.budgetDetails ?? [];
  if (items.length === 0) return "";

  const totalEstimate = items.reduce((acc, b) => acc + (Number(b.estimatedAmount) || 0), 0);

  const cellStyle = (bg: string | null, bold: boolean, align: "left" | "center" | "right", widthDxa: number, color = "0F172A") => `
    <w:tcPr>
      <w:tcW w:w="${widthDxa}" w:type="dxa"/>
      <w:tcBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      </w:tcBorders>
      ${bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : ""}
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p>
      <w:pPr>
        <w:spacing w:before="40" w:after="40"/>
        <w:jc w:val="${align}"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          ${bold ? "<w:b/>" : ""}
          <w:color w:val="${color}"/>
          <w:sz w:val="18"/>
        </w:rPr>
  `;

  const makeCell = (text: string, bg: string | null, bold: boolean, align: "left" | "center" | "right", widthDxa: number, color = "0F172A") =>
    `<w:tc>${cellStyle(bg, bold, align, widthDxa, color)}<w:t xml:space="preserve">${formatXmlRunsText(text)}</w:t></w:r></w:p></w:tc>`;

  // Group by section label
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const grp = item.sectionLabel || "Umum";
    if (!grouped.has(grp)) grouped.set(grp, []);
    grouped.get(grp)!.push(item);
  }

  let bodyRowsXml = "";
  for (const [groupName, groupItems] of Array.from(grouped.entries())) {
    bodyRowsXml += `<w:tr>
      <w:tc>
        <w:tcPr>
          <w:gridSpan w:val="7"/>
          <w:tcBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          </w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="F0F6FA"/>
        </w:tcPr>
        <w:p><w:pPr><w:spacing w:before="50" w:after="50"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="0B2545"/><w:sz w:val="19"/></w:rPr><w:t>${escapeXml(groupName)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>`;

    for (const row of groupItems) {
      bodyRowsXml += `<w:tr>
        ${makeCell(row.itemName, null, false, "left", 2400)}
        ${makeCell(row.requiredDate || "-", null, false, "center", 1300)}
        ${makeCell(String(row.qty), null, false, "center", 650)}
        ${makeCell(row.uom || "Set", null, false, "center", 750)}
        ${makeCell(formatRupiahDisplay(row.unitPrice), null, false, "right", 1300)}
        ${makeCell(formatRupiahDisplay(row.estimatedAmount), null, true, "right", 1350)}
        ${makeCell(row.notes || "-", null, false, "left", 1900)}
      </w:tr>`;
    }
  }

  return `
  <w:p><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="0B2545"/><w:sz w:val="22"/></w:rPr><w:t>Rincian Estimasi Keperluan Pembiayaan (${escapeXml(data.eventName)})</w:t></w:r></w:p>
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="9650" w:type="dxa"/>
      <w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar>
    </w:tblPr>
    <w:tr>
      ${makeCell("Keperluan", "0B2545", true, "center", 2400, "FFFFFF")}
      ${makeCell("Tanggal Diperlukan", "0B2545", true, "center", 1300, "FFFFFF")}
      ${makeCell("Qty", "0B2545", true, "center", 650, "FFFFFF")}
      ${makeCell("UOM", "0B2545", true, "center", 750, "FFFFFF")}
      ${makeCell("Harga Satuan", "0B2545", true, "center", 1300, "FFFFFF")}
      ${makeCell("Harga Total", "0B2545", true, "center", 1350, "FFFFFF")}
      ${makeCell("Keterangan", "0B2545", true, "center", 1900, "FFFFFF")}
    </w:tr>
    ${bodyRowsXml}
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:gridSpan w:val="5"/>
          <w:tcBorders><w:top w:val="single" w:sz="6" w:color="0B2545"/><w:left w:val="single" w:sz="4" color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:color="0B2545"/><w:right w:val="single" w:sz="4" color="CBD5E1"/></w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
        </w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0B2545"/><w:sz w:val="20"/></w:rPr><w:t>TOTAL RINCIAN PEMBIAYAAN</w:t></w:r></w:p>
      </w:tc>
      ${makeCell(formatRupiahDisplay(totalEstimate), "F8FAFC", true, "right", 1350, "0B2545")}
      ${makeCell("", "F8FAFC", false, "left", 1900)}
    </w:tr>
  </w:tbl>`;
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Sesi tidak ditemukan. Silakan login terlebih dahulu." },
      { status: 401 }
    );
  }

  try {
    const data = (await request.json()) as EventProjectBriefData;
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

    let docXml = await docFile.async("string");

    // 1. Replace exact Cover & Narrative Placeholders across document.xml
    const scalarReplacements: [string, string][] = [
      ["[NAMA ACARA &amp; TAHUN]", data.eventName],
      ["[TEMA UTAMA ACARA]", data.mainTheme],
      ["[Kitab Pasal:Ayat]", data.scriptureRef],
      ['&quot;[Tuliskan kutipan ayat Alkitab yang menjadi dasar tema acara di sini.]&quot;', `"${data.scriptureQuote}"`],
      ["[Tuliskan kutipan ayat Alkitab yang menjadi dasar tema acara di sini.]", data.scriptureQuote],
      ["[TANGGAL BULAN TAHUN]  |  [JAM MULAI] WIB", `${data.eventDate}  |  ${data.eventTime}`],
      ["[LOKASI / VENUE ACARA]", data.location],
      ["[1. Prosedur penyambutan peserta, absensi, dan pembagian perlengkapan acara...]", data.techEvent1],
      ["[2. Pengaturan area tempat duduk peserta &amp; pendamping/orang tua...]", data.techEvent2],
      ["[3. Koordinasi ketertiban selama ibadah dan acara berlangsung...]", data.techEvent3],
      ["[1. Urutan pemanggilan perwakilan / alur masuk panggung...]", data.techSpecial1],
      ["[2. Lagu pengiring, posisi MC, dan penyerahan properti...]", data.techSpecial2],
      ["[3. Cue lighting &amp; multimedia...]", data.techSpecial3],
      ["[1. Pengarahan MC sebelum sesi penampilan dimulai (termasuk imbauan dokumentasi)...]", data.techPerf1],
      ["[2. Alur transisi antar-penampilan oleh MC &amp; stage crew...]", data.techPerf2],
      ["[3. Prosedur penilaian juri / pengumuman hasil (jika ada)...]", data.techPerf3],
    ];

    for (const [placeholder, value] of scalarReplacements) {
      docXml = docXml.split(placeholder).join(formatXmlRunsText(value || "-"));
    }

    // Also unescaped quote variants in XML
    docXml = docXml
      .split('"[Tuliskan kutipan ayat Alkitab yang menjadi dasar tema acara di sini.]"')
      .join(formatXmlRunsText(`"${data.scriptureQuote}"`));

    // 1b. Replace Section 08 (Teknis Pelaksanaan) with Dynamic Technical Sections OOXML
    {
      const techAnchor = docXml.indexOf(">TEKNIS PELAKSANAAN<");
      if (techAnchor !== -1) {
        const headingEnd = docXml.indexOf("</w:p>", techAnchor);
        const sectPrIdx = docXml.indexOf("<w:sectPr", headingEnd);
        const sectPrParaStart = sectPrIdx !== -1 ? docXml.lastIndexOf("<w:p", sectPrIdx) : -1;
        if (headingEnd !== -1 && sectPrParaStart !== -1 && sectPrParaStart > headingEnd) {
          const dynamicSections = resolveTechnicalSections(data);
          const dynamicXml = dynamicSections
            .map((grp) => {
              const titleXml = `<w:p><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="31849B"/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(
                grp.title || "-"
              )}</w:t></w:r></w:p>`;
              const validItems = grp.items.filter((line) => line.trim().length > 0);
              const itemsXml = (validItems.length > 0 ? validItems : ["-"])
                .map(
                  (line) =>
                    `<w:p><w:pPr><w:spacing w:before="20" w:after="40"/><w:ind w:left="255"/></w:pPr><w:r><w:rPr><w:color w:val="1E293B"/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">${escapeXml(
                      line
                    )}</w:t></w:r></w:p>`
                )
                .join("");
              return `${titleXml}${itemsXml}`;
            })
            .join("");
          docXml =
            docXml.slice(0, headingEnd + "</w:p>".length) +
            dynamicXml +
            docXml.slice(sectPrParaStart);
        }
      }
    }

    // 2. Patch All 18 Tables Structurally
    const tableBlocks = extractTopLevelBlocks(docXml, "w:tbl");

    if (tableBlocks.length >= 18) {
      const updatedTables: { start: number; end: number; xml: string }[] = [];

      // Table #1 (idx 0): 01. PROJECT OVERVIEW (8 key-value rows)
      {
        const tbl = tableBlocks[0];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const vals = [
          data.mainTheme,
          `${data.scriptureRef} — "${data.scriptureQuote}"`,
          data.tagline,
          data.background,
          data.keyMessage,
          data.objectives,
          data.targetAudience,
          data.coreConcept,
        ];
        const fixedRows = rows.map((tr, i) => {
          if (i >= vals.length) return tr;
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 2) {
            cells[1] = replaceCellText(cells[1], vals[i] || "-");
          }
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #2 (idx 1): Desired Atmosphere
      {
        const tbl = tableBlocks[1];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const fixedRows = rows.map((tr) => {
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 2) cells[1] = replaceCellText(cells[1], data.desiredAtmosphere || "-");
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #3 (idx 2): Participant Journey (Rows 1..6)
      {
        const tbl = tableBlocks[2];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const journeyVals = [
          data.journeyBefore,
          data.journeyArrival,
          data.journeyOpening,
          data.journeyMain,
          data.journeyClosing,
          data.journeyAfter,
        ];
        const fixedRows = rows.map((tr, i) => {
          if (i === 0 || i > journeyVals.length) return tr;
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 3) cells[2] = replaceCellText(cells[2], journeyVals[i - 1] || "-");
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #4 (idx 3): 03A. SECTION ACARA (6 rows)
      {
        const tbl = tableBlocks[3];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const vals = [
          data.acaraConcept,
          data.acaraProgram,
          data.acaraSpecialMoment,
          data.acaraTalent,
          data.acaraDuration,
          data.acaraSpecialReq,
        ];
        const fixedRows = rows.map((tr, i) => {
          if (i >= vals.length) return tr;
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 2) cells[1] = replaceCellText(cells[1], vals[i] || "-");
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #5 (idx 4): 03B. SECTION DEKORASI Concept (6 rows)
      {
        const tbl = tableBlocks[4];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const vals = [
          data.decorConcept,
          data.decorStyle,
          data.decorPalette,
          data.decorKeyVisual,
          data.decorAreas,
          data.decorSpecialReq,
        ];
        const fixedRows = rows.map((tr, i) => {
          if (i >= vals.length) return tr;
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 2) cells[1] = replaceCellText(cells[1], vals[i] || "-");
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #6 (idx 5): Visualisasi Dekorasi box
      {
        const tbl = tableBlocks[5];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const fixedRows = rows.map((tr) => {
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 1) {
            cells[0] = replaceCellText(
              cells[0],
              data.decorImageUrl
                ? `Referensi Mockup Visualisasi Dekorasi: ${data.decorImageUrl}`
                : "Belum ada tautan mockup dekorasi panggung dilampirkan."
            );
          }
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #7 (idx 6): Daftar Kebutuhan Item Dekorasi (Dynamic Rows)
      {
        const tbl = tableBlocks[6];
        const rowData = (data.decorItems ?? []).map((item, idx) => [
          String(idx + 1),
          item.name || "-",
          item.qty || "1",
          item.description || "-",
        ]);
        updatedTables.push({ ...tbl, xml: buildDynamicListTable(tbl.xml, rowData) });
      }

      // Table #8 (idx 7): 03C. Equipment / Perlengkapan (Dynamic Rows)
      {
        const tbl = tableBlocks[7];
        const rowData = (data.equipmentItems ?? []).map((eq, idx) => [
          String(idx + 1),
          eq.name || "-",
          eq.qty || "1",
          eq.purpose || "-",
          eq.priority || "Med",
        ]);
        updatedTables.push({ ...tbl, xml: buildDynamicListTable(tbl.xml, rowData) });
      }

      // Table #9 (idx 8): Special Technical Requirements
      {
        const tbl = tableBlocks[8];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const fixedRows = rows.map((tr) => {
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 1) {
            cells[0] = replaceCellText(cells[0], data.techRequirements || "-", "last");
          }
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #10 (idx 9): 03D. DOKUMENTASI (5 rows)
      {
        const tbl = tableBlocks[9];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const vals = [
          data.docObjective,
          data.docContent,
          data.docShotlist,
          data.docPlatforms,
          data.docTarget,
        ];
        const fixedRows = rows.map((tr, i) => {
          if (i >= vals.length) return tr;
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 2) cells[1] = replaceCellText(cells[1], vals[i] || "-");
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #11 (idx 10): 04. BUDGET OVERVIEW + Appended Gambar 1 Rincian Table
      {
        const tbl = tableBlocks[10];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const overviewRows = data.budgetOverview ?? [];
        const totalEst = overviewRows.reduce((s, r) => s + (Number(r.estimated) || 0), 0);
        const totalAct = overviewRows.reduce((s, r) => s + (Number(r.actual) || 0), 0);

        const headerRow = rows[0];
        const templateRow = rows[1];
        const totalFooterRow = rows[rows.length - 1];

        const builtRows = (overviewRows.length > 0 ? overviewRows : [
          { category: "Acara", estimated: 0, actual: 0, status: "Planning" },
        ]).map((r) =>
          populateRowCells(templateRow, [
            r.category,
            formatRupiahDisplay(r.estimated),
            r.actual > 0 ? formatRupiahDisplay(r.actual) : "—",
            r.status || "Planning",
          ])
        );

        const fixedTotalRow = populateRowCells(totalFooterRow, [
          "TOTAL ESTIMASI",
          formatRupiahDisplay(totalEst),
          totalAct > 0 ? formatRupiahDisplay(totalAct) : "—",
          totalEst > 0 ? "Synced" : "Planning",
        ]);

        const detailTableXml = buildBudgetDetailOoxmlBlock(data);
        updatedTables.push({
          ...tbl,
          xml: `${prefix}${headerRow}${builtRows.join("")}${fixedTotalRow}${suffix}${detailTableXml}`,
        });
      }

      // Table #12 (idx 11): 05. Org Chart box
      {
        const tbl = tableBlocks[11];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const fixedRows = rows.map((tr) => {
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 1) {
            cells[0] = replaceCellText(
              cells[0],
              data.orgChartUrl
                ? `Bagan Struktur Organisasi: ${data.orgChartUrl}`
                : "Struktur Kepanitiaan Event (Lihat Rincian Tabel Key People & PIC di Bawah)"
            );
          }
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #13 (idx 12): 05. KEY PEOPLE & PIC (Dynamic from Secretariat Struktur Builder)
      {
        const tbl = tableBlocks[12];
        const rowData = (data.committee ?? []).map((c) => [
          c.role || "-",
          c.pic || "-",
          c.contact || "-",
        ]);
        updatedTables.push({ ...tbl, xml: buildDynamicListTable(tbl.xml, rowData) });
      }

      // Table #14 (idx 13): 06. DAFTAR PELAYAN ACARA (Dynamic from Secretariat Struktur Pelayan)
      {
        const tbl = tableBlocks[13];
        const rowData = (data.ministers ?? []).map((m) => [
          m.role || "-",
          m.members || "-",
          m.notes || "-",
        ]);
        updatedTables.push({ ...tbl, xml: buildDynamicListTable(tbl.xml, rowData) });
      }

      // Table #15 (idx 14): 07. RUNDOWN SUMMARY (2 rows)
      {
        const tbl = tableBlocks[14];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const fixedRows = rows.map((tr, i) =>
          i === 1
            ? populateRowCells(tr, [
                data.rundownTotalDuration || "-",
                data.rundownOpenGate || "-",
                data.rundownStartTime || "-",
                data.rundownEndTime || "-",
              ])
            : tr
        );
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Table #16 (idx 15): 07. SUSUNAN ACARA (Dynamic from Active Event Rundown)
      {
        const tbl = tableBlocks[15];
        const rowData = (data.rundown ?? []).map((r) => [
          r.time || "-",
          r.duration || "-",
          r.activity || "-",
          r.pic || "-",
          r.notes || "-",
        ]);
        updatedTables.push({ ...tbl, xml: buildDynamicListTable(tbl.xml, rowData) });
      }

      // Table #17 (idx 16): 09. APPROVAL (Dynamic)
      {
        const tbl = tableBlocks[16];
        const rowData = (data.approvals ?? []).map((a) => [
          a.role || "-",
          a.name || "-",
          "",
          a.date || "",
        ]);
        updatedTables.push({ ...tbl, xml: buildDynamicListTable(tbl.xml, rowData) });
      }

      // Table #18 (idx 17): Final Creative Direction
      {
        const tbl = tableBlocks[17];
        const { prefix, rows, suffix } = splitTableParts(tbl.xml);
        const fixedRows = rows.map((tr) => {
          const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
          if (cells.length >= 1) {
            cells[0] = replaceCellText(cells[0], data.finalCreativeDirection || "-", "last");
          }
          return `${rp}${cells.join("")}${rs}`;
        });
        updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
      }

      // Stitch back from end to start so character offsets stay exact
      updatedTables.sort((a, b) => b.start - a.start);
      for (const blk of updatedTables) {
        docXml = docXml.slice(0, blk.start) + blk.xml + docXml.slice(blk.end);
      }
    }

    zip.file("word/document.xml", docXml);
    const outBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const safeFilename = `${(data.eventName || "Event-Project-Brief")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")}-Brief.docx`;

    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store",
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
