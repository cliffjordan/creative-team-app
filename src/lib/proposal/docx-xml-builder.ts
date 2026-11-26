import {
  EventProjectBriefData,
  formatDocumentGroupItems,
  resolveAcaraSections,
  resolveAtmosphereItems,
  resolveDecorSections,
  resolveFinalDirectionItems,
  resolveJourneySections,
  resolveOverviewSections,
  resolvePddSections,
  resolveTechRequirementItems,
  resolveTechnicalSections,
} from "@/lib/proposal/export-proposal-word";

function escapeXml(str: string): string {
  const sanitized = String(str ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatXmlRunsText(value: string): string {
  const safe = String(value ?? "").replace(/\r\n?/g, "\n");
  if (!safe.includes("\n")) {
    return escapeXml(safe);
  }
  return safe
    .split("\n")
    .map((line) => escapeXml(line))
    .join('</w:t><w:br/><w:t xml:space="preserve">');
}

function formatRupiahDisplay(amount: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)}`;
}

/**
 * Finds the start index of the enclosing <w:p ...> or <w:p> tag before `beforeIdx`,
 * strictly ignoring similarly prefixed tags such as <w:pPr> or <w:pBdr>.
 */
function findEnclosingParagraphStart(xml: string, beforeIdx: number): number {
  let cursor = beforeIdx;
  while (cursor >= 0) {
    const idx = xml.lastIndexOf("<w:p", cursor);
    if (idx === -1) return -1;
    const nextCh = xml[idx + 4];
    if (nextCh === " " || nextCh === ">") {
      return idx;
    }
    cursor = idx - 1;
  }
  return -1;
}

/**
 * Replaces the text of a single <w:t> node (either index 0 or last) inside an XML block.
 */
function replaceCellText(
  cellXml: string,
  newText: string,
  wtIndex: "first" | "last" = "last"
): string {
  const matches = Array.from(cellXml.matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g));
  if (matches.length === 0) {
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

function populateRowCells(
  trXml: string,
  values: string[],
  wtIndex: "first" | "last" = "last"
): string {
  const { prefix, cells, suffix } = splitRowCells(trXml);
  const updated = cells.map((cell, idx) =>
    idx < values.length ? replaceCellText(cell, values[idx], wtIndex) : cell
  );
  return `${prefix}${updated.join("")}${suffix}`;
}

function buildKeyValueDynamicTable(
  tblXml: string,
  entries: Array<{ title: string; value: string }>
): string {
  const { prefix, rows, suffix } = splitTableParts(tblXml);
  if (rows.length === 0) return tblXml;

  const templateRow = rows[0];
  const targetEntries =
    entries.length > 0 ? entries : [{ title: "-", value: "Belum ada data" }];

  const builtRows = targetEntries.map((entry, idx) => {
    const rowBase = idx < rows.length ? rows[idx] : rows[rows.length - 1] ?? templateRow;
    const { prefix: rp, cells, suffix: rs } = splitRowCells(rowBase);
    if (cells.length >= 2) {
      cells[0] = replaceCellText(cells[0], entry.title || "-", "first");
      cells[1] = replaceCellText(cells[1], entry.value || "-", "last");
    } else if (cells.length === 1) {
      cells[0] = replaceCellText(cells[0], `${entry.title}: ${entry.value}`, "last");
    }
    return `${rp}${cells.join("")}${rs}`;
  });

  return `${prefix}${builtRows.join("")}${suffix}`;
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
  const builtDataRows = targetRows.map((rowValues, idx) => {
    const rowBase =
      !hasFooterRow && idx + 1 < rows.length ? rows[idx + 1] : templateDataRow;
    return populateRowCells(rowBase, rowValues, "last");
  });

  return `${prefix}${headerRow}${builtDataRows.join("")}${footerRow ?? ""}${suffix}`;
}

function buildBudgetDetailOoxmlBlock(data: EventProjectBriefData): string {
  const items = data.budgetDetails ?? [];
  if (items.length === 0) return "";

  const totalEstimate = items.reduce((acc, b) => acc + (Number(b.estimatedAmount) || 0), 0);

  const cellStyle = (
    bg: string | null,
    bold: boolean,
    align: "left" | "center" | "right",
    widthDxa: number,
    color = "0F172A"
  ) => `<w:tcPr>
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
        </w:rPr>`;

  const makeCell = (
    text: string,
    bg: string | null,
    bold: boolean,
    align: "left" | "center" | "right",
    widthDxa: number,
    color = "0F172A"
  ) =>
    `<w:tc>${cellStyle(bg, bold, align, widthDxa, color)}<w:t xml:space="preserve">${formatXmlRunsText(
      text
    )}</w:t></w:r></w:p></w:tc>`;

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
        <w:p><w:pPr><w:spacing w:before="50" w:after="50"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="0B2545"/><w:sz w:val="19"/></w:rPr><w:t>${escapeXml(
          groupName
        )}</w:t></w:r></w:p>
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

  return `<w:p><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="0B2545"/><w:sz w:val="22"/></w:rPr><w:t>Rincian Estimasi Keperluan Pembiayaan (${escapeXml(
    data.eventName
  )})</w:t></w:r></w:p><w:tbl>
    <w:tblPr>
      <w:tblW w:w="9650" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
      <w:tblLayout w:type="fixed"/>
      <w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="2400"/>
      <w:gridCol w:w="1300"/>
      <w:gridCol w:w="650"/>
      <w:gridCol w:w="750"/>
      <w:gridCol w:w="1300"/>
      <w:gridCol w:w="1350"/>
      <w:gridCol w:w="1900"/>
    </w:tblGrid>
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
          <w:tcW w:w="6400" w:type="dxa"/>
          <w:gridSpan w:val="5"/>
          <w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="0B2545"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="0B2545"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/></w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
        </w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="0B2545"/><w:sz w:val="20"/></w:rPr><w:t>TOTAL RINCIAN PEMBIAYAAN</w:t></w:r></w:p>
      </w:tc>
      ${makeCell(formatRupiahDisplay(totalEstimate), "F8FAFC", true, "right", 1350, "0B2545")}
      ${makeCell("", "F8FAFC", false, "left", 1900)}
    </w:tr>
  </w:tbl>`;
}

/**
 * Applies structured Project Brief data directly onto the Word OOXML template
 * (`word/document.xml`), preserving header, footer, margins, and table layouts.
 */
export function applyBriefDataToDocumentXml(
  initialDocXml: string,
  data: EventProjectBriefData
): string {
  let docXml = initialDocXml;

  // 1. Patch Cover placeholders only BEFORE the first <w:tbl> so inner table cells aren't prematurely split
  const firstTableIdx = docXml.indexOf("<w:tbl");
  const coverSegment = firstTableIdx !== -1 ? docXml.slice(0, firstTableIdx) : docXml;
  const bodyAfterCover = firstTableIdx !== -1 ? docXml.slice(firstTableIdx) : "";

  const scalarReplacements: [string, string][] = [
    ["[NAMA ACARA &amp; TAHUN]", data.eventName],
    ["[TEMA UTAMA ACARA]", data.mainTheme],
    ["[Kitab Pasal:Ayat]", data.scriptureRef],
    ['&quot;[Tuliskan kutipan ayat Alkitab yang menjadi dasar tema acara di sini.]&quot;', `"${data.scriptureQuote}"`],
    ["[Tuliskan kutipan ayat Alkitab yang menjadi dasar tema acara di sini.]", data.scriptureQuote],
    ['"[Tuliskan kutipan ayat Alkitab yang menjadi dasar tema acara di sini.]"', `"${data.scriptureQuote}"`],
    ["[TANGGAL BULAN TAHUN]  |  [JAM MULAI] WIB", `${data.eventDate}  |  ${data.eventTime}`],
    ["[LOKASI / VENUE ACARA]", data.location],
  ];

  let patchedCover = coverSegment;
  for (const [placeholder, value] of scalarReplacements) {
    patchedCover = patchedCover.split(placeholder).join(formatXmlRunsText(value || "-"));
  }
  docXml = `${patchedCover}${bodyAfterCover}`;

  // 1b. Replace Section 08 (Teknis Pelaksanaan) with Dynamic Technical Sections OOXML cleanly on paragraph boundary
  {
    const techAnchor = docXml.indexOf(">TEKNIS PELAKSANAAN<");
    if (techAnchor !== -1) {
      const headingEnd = docXml.indexOf("</w:p>", techAnchor);
      const sectPrIdx = headingEnd !== -1 ? docXml.indexOf("<w:sectPr", headingEnd) : -1;
      const sectPrParaStart =
        sectPrIdx !== -1 ? findEnclosingParagraphStart(docXml, sectPrIdx) : -1;

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

    // Table #1 (idx 0): 01. PROJECT OVERVIEW (Dynamic Key-Value Sub-Bagian)
    {
      const tbl = tableBlocks[0];
      const entries = resolveOverviewSections(data).map((grp) => ({
        title: grp.title || "-",
        value: formatDocumentGroupItems(grp.items),
      }));
      updatedTables.push({ ...tbl, xml: buildKeyValueDynamicTable(tbl.xml, entries) });
    }

    // Table #2 (idx 1): Desired Atmosphere (Dynamic Points)
    {
      const tbl = tableBlocks[1];
      const { prefix, rows, suffix } = splitTableParts(tbl.xml);
      const atmosphereText = formatDocumentGroupItems(resolveAtmosphereItems(data));
      const fixedRows = rows.map((tr) => {
        const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
        if (cells.length >= 2) cells[1] = replaceCellText(cells[1], atmosphereText, "last");
        return `${rp}${cells.join("")}${rs}`;
      });
      updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
    }

    // Table #3 (idx 2): Participant Journey (Dynamic Phase Rows)
    {
      const tbl = tableBlocks[2];
      const { prefix, rows, suffix } = splitTableParts(tbl.xml);
      const journeyRows = resolveJourneySections(data).map((grp, idx) => [
        String(idx + 1),
        grp.title || "-",
        formatDocumentGroupItems(grp.items),
      ]);
      const headerRow = rows[0] ?? "";
      const templateRow = rows[1] ?? rows[0];
      const builtRows = (journeyRows.length > 0 ? journeyRows : [["1", "-", "Belum ada data"]]).map(
        (vals, idx) => {
          const rowBase = idx + 1 < rows.length ? rows[idx + 1] : templateRow;
          const { prefix: rp, cells, suffix: rs } = splitRowCells(rowBase);
          if (cells.length >= 3) {
            cells[0] = replaceCellText(cells[0], vals[0], "first");
            cells[1] = replaceCellText(cells[1], vals[1], "first");
            cells[2] = replaceCellText(cells[2], vals[2], "last");
          }
          return `${rp}${cells.join("")}${rs}`;
        }
      );
      updatedTables.push({ ...tbl, xml: `${prefix}${headerRow}${builtRows.join("")}${suffix}` });
    }

    // Table #4 (idx 3): 03A. SECTION ACARA (Dynamic Key-Value Sub-Bagian)
    {
      const tbl = tableBlocks[3];
      const entries = resolveAcaraSections(data).map((grp) => ({
        title: grp.title || "-",
        value: formatDocumentGroupItems(grp.items),
      }));
      updatedTables.push({ ...tbl, xml: buildKeyValueDynamicTable(tbl.xml, entries) });
    }

    // Table #5 (idx 4): 03B. SECTION DEKORASI Concept (Dynamic Key-Value Sub-Bagian)
    {
      const tbl = tableBlocks[4];
      const entries = resolveDecorSections(data).map((grp) => ({
        title: grp.title || "-",
        value: formatDocumentGroupItems(grp.items),
      }));
      updatedTables.push({ ...tbl, xml: buildKeyValueDynamicTable(tbl.xml, entries) });
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

    // Table #9 (idx 8): Special Technical Requirements (Dynamic Points)
    {
      const tbl = tableBlocks[8];
      const { prefix, rows, suffix } = splitTableParts(tbl.xml);
      const techReqText = formatDocumentGroupItems(resolveTechRequirementItems(data));
      const fixedRows = rows.map((tr) => {
        const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
        if (cells.length >= 1) {
          cells[0] = replaceCellText(cells[0], techReqText, "last");
        }
        return `${rp}${cells.join("")}${rs}`;
      });
      updatedTables.push({ ...tbl, xml: `${prefix}${fixedRows.join("")}${suffix}` });
    }

    // Table #10 (idx 9): 03D. DOKUMENTASI (Dynamic Key-Value Sub-Bagian)
    {
      const tbl = tableBlocks[9];
      const entries = resolvePddSections(data).map((grp) => ({
        title: grp.title || "-",
        value: formatDocumentGroupItems(grp.items),
      }));
      updatedTables.push({ ...tbl, xml: buildKeyValueDynamicTable(tbl.xml, entries) });
    }

    // Table #11 (idx 10): 04. BUDGET OVERVIEW + Appended Rincian Table
    {
      const tbl = tableBlocks[10];
      const { prefix, rows, suffix } = splitTableParts(tbl.xml);
      const overviewRows = data.budgetOverview ?? [];
      const totalEst = overviewRows.reduce((s, r) => s + (Number(r.estimated) || 0), 0);
      const totalAct = overviewRows.reduce((s, r) => s + (Number(r.actual) || 0), 0);

      const headerRow = rows[0];
      const templateRow = rows[1];
      const totalFooterRow = rows[rows.length - 1];

      const builtRows = (
        overviewRows.length > 0
          ? overviewRows
          : [{ category: "Acara", estimated: 0, actual: 0, status: "Planning" }]
      ).map((r) =>
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

    // Table #13 (idx 12): 05. KEY PEOPLE & PIC
    {
      const tbl = tableBlocks[12];
      const rowData = (data.committee ?? []).map((c) => [
        c.role || "-",
        c.pic || "-",
        c.contact || "-",
      ]);
      updatedTables.push({ ...tbl, xml: buildDynamicListTable(tbl.xml, rowData) });
    }

    // Table #14 (idx 13): 06. DAFTAR PELAYAN ACARA
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

    // Table #16 (idx 15): 07. SUSUNAN ACARA (Dynamic)
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

    // Table #18 (idx 17): Final Creative Direction (Dynamic Points)
    {
      const tbl = tableBlocks[17];
      const { prefix, rows, suffix } = splitTableParts(tbl.xml);
      const directionText = formatDocumentGroupItems(resolveFinalDirectionItems(data));
      const fixedRows = rows.map((tr) => {
        const { prefix: rp, cells, suffix: rs } = splitRowCells(tr);
        if (cells.length >= 1) {
          cells[0] = replaceCellText(cells[0], directionText, "last");
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

  return docXml;
}
