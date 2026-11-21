import { sanitizeHttpUrl } from "@/lib/utils";

export interface ProposalCommitteeRow {
  role: string;
  names: string;
}

export interface ProposalDecorItem {
  name: string;
  description: string;
}

export interface ProposalBudgetItem {
  item: string;
  qty: string;
  amount: number;
}

export interface ProposalMinisterRow {
  role: string;
  members: string;
}

export interface ProposalRundownRow {
  time: string;
  duration: string;
  activity: string;
  pic: string;
  notes: string;
}

export interface ProposalData {
  title: string;
  concept: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  location: string;
  themeVerse: string;
  background: string;
  objectives: string[];
  detailAtmosphere: string;
  detailDressCode: string;
  detailOpeningEvent: string;
  detailOpeningPerformance: string;
  detailMainShow: string;
  detailSermon: string;
  committeeTitle: string;
  committee: ProposalCommitteeRow[];
  decorImageUrl: string;
  decorItems: ProposalDecorItem[];
  budgets: ProposalBudgetItem[];
  ministers: ProposalMinisterRow[];
  rundownTotalDuration: string;
  rundownStartTime: string;
  rundownEndTime: string;
  rundown: ProposalRundownRow[];
  techEvent: string;
  techSpecialSession: string;
  techPerformance: string;
  approverLeader: string;
  approverSecretary: string;
  approverTreasurer: string;
  approverPastor: string;
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

export function exportProposalToWord(data: ProposalData): void {
  const totalBudget = data.budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const safeDecorImageUrl = sanitizeHttpUrl(data.decorImageUrl);

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.title)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page {
    size: A4;
    margin: 2cm 2cm 2cm 2cm;
  }
  body {
    font-family: Calibri, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #1e293b;
  }
  h1 {
    font-size: 18pt;
    color: #1e1b4b;
    text-align: center;
    margin-bottom: 4pt;
  }
  .subtitle {
    font-size: 13pt;
    color: #4338ca;
    text-align: center;
    font-weight: bold;
    margin-bottom: 16pt;
  }
  h2 {
    font-size: 13pt;
    color: #1e1b4b;
    border-bottom: 1.5pt solid #4338ca;
    padding-bottom: 3pt;
    margin-top: 16pt;
    margin-bottom: 8pt;
  }
  h3 {
    font-size: 11.5pt;
    color: #312e81;
    margin-top: 10pt;
    margin-bottom: 4pt;
  }
  p {
    margin: 0 0 8pt 0;
    text-align: justify;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6pt;
    margin-bottom: 12pt;
    font-size: 10pt;
  }
  th, td {
    border: 1px solid #94a3b8;
    padding: 5pt 7pt;
    vertical-align: top;
  }
  th {
    background-color: #eef2ff;
    color: #1e1b4b;
    font-weight: bold;
    text-align: left;
  }
  .meta-table td {
    border: none;
    padding: 3pt 5pt;
  }
  .total-row td {
    background-color: #f8fafc;
    font-weight: bold;
  }
  .sign-table td {
    border: none;
    text-align: center;
    padding-top: 24pt;
    width: 25%;
  }
  ul, ol {
    margin: 0 0 8pt 18pt;
    padding: 0;
  }
  li {
    margin-bottom: 4pt;
  }
</style>
</head>
<body>
  <h1>${escapeHtml(data.title)}</h1>
  <div class="subtitle">Konsep: &ldquo;${escapeHtml(data.concept)}&rdquo;</div>

  <table class="meta-table">
    <tr><td style="width:130pt;"><strong>NAMA ACARA</strong></td><td>: ${escapeHtml(data.eventName)}</td></tr>
    <tr><td><strong>TANGGAL</strong></td><td>: ${escapeHtml(data.eventDate)}</td></tr>
    <tr><td><strong>WAKTU</strong></td><td>: ${escapeHtml(data.eventTime)}</td></tr>
    <tr><td><strong>TEMPAT / LOKASI</strong></td><td>: ${escapeHtml(data.location)}</td></tr>
    <tr><td><strong>AYAT TEMA</strong></td><td>: ${escapeHtml(data.themeVerse)}</td></tr>
  </table>

  <h2>1. Latar Belakang</h2>
  <p>${escapeHtml(data.background).replace(/\n/g, "<br/>")}</p>

  <h2>2. Tujuan Acara</h2>
  <ol>
    ${data.objectives.map((obj) => `<li>${escapeHtml(obj)}</li>`).join("")}
  </ol>

  <h2>3. Konsep Detail</h2>
  <h3>Suasana &amp; Dekorasi</h3>
  <p>${escapeHtml(data.detailAtmosphere)}</p>
  <h3>Pakaian (Dress Code)</h3>
  <p>${escapeHtml(data.detailDressCode)}</p>
  <h3>Opening Acara</h3>
  <p>${escapeHtml(data.detailOpeningEvent)}</p>
  <h3>Opening Penampilan</h3>
  <p>${escapeHtml(data.detailOpeningPerformance)}</p>
  <h3>Inti Acara / Penampilan</h3>
  <p>${escapeHtml(data.detailMainShow)}</p>
  <h3>Penyampaian Firman</h3>
  <p>${escapeHtml(data.detailSermon)}</p>

  <h2>4. ${escapeHtml(data.committeeTitle)}</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 38%;">Jabatan / Seksi</th>
        <th>Koordinator / Anggota</th>
      </tr>
    </thead>
    <tbody>
      ${data.committee
        .map(
          (c) => `
      <tr>
        <td><strong>${escapeHtml(c.role)}</strong></td>
        <td>${escapeHtml(c.names)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>

  <h2>5. Dekorasi</h2>
  ${
    safeDecorImageUrl
      ? `<p><em>Referensi Visualisasi Dekorasi:</em> <a href="${escapeHtml(safeDecorImageUrl)}">${escapeHtml(safeDecorImageUrl)}</a></p>`
      : ""
  }
  <table>
    <thead>
      <tr>
        <th style="width: 35pt; text-align:center;">No.</th>
        <th style="width: 180pt;">Item Dekorasi</th>
        <th>Keterangan / Fungsi</th>
      </tr>
    </thead>
    <tbody>
      ${data.decorItems
        .map(
          (d, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${escapeHtml(d.name)}</td>
        <td>${escapeHtml(d.description)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>

  <h2>6. Estimasi Kebutuhan Anggaran</h2>
  <table>
    <thead>
      <tr>
        <th>Keperluan</th>
        <th style="width: 80pt;">QTY</th>
        <th style="width: 130pt; text-align:right;">Total Dana Diperlukan</th>
      </tr>
    </thead>
    <tbody>
      ${data.budgets
        .map(
          (b) => `
      <tr>
        <td>${escapeHtml(b.item)}</td>
        <td>${escapeHtml(b.qty)}</td>
        <td style="text-align:right;">${formatRupiah(b.amount)}</td>
      </tr>`
        )
        .join("")}
      <tr class="total-row">
        <td colspan="2" style="text-align:right;">TOTAL ESTIMASI ANGGARAN</td>
        <td style="text-align:right;">${formatRupiah(totalBudget)}</td>
      </tr>
    </tbody>
  </table>

  <h2>7. Daftar Pelayan Acara</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 35%;">Bidang Pelayanan</th>
        <th>Nama Pelayan / Tim</th>
      </tr>
    </thead>
    <tbody>
      ${data.ministers
        .map(
          (m) => `
      <tr>
        <td><strong>${escapeHtml(m.role)}</strong></td>
        <td>${escapeHtml(m.members)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>

  <h2>8. Susunan Acara (Rundown)</h2>
  <p>
    <strong>Lama Waktu Acara:</strong> ${escapeHtml(data.rundownTotalDuration)}<br/>
    <strong>Jam Mulai:</strong> ${escapeHtml(data.rundownStartTime)} &nbsp;|&nbsp;
    <strong>Jam Selesai:</strong> ${escapeHtml(data.rundownEndTime)}
  </p>
  <table>
    <thead>
      <tr>
        <th style="width: 85pt;">Waktu</th>
        <th style="width: 45pt;">Durasi</th>
        <th>Kegiatan</th>
        <th style="width: 90pt;">PIC</th>
        <th>Keterangan</th>
      </tr>
    </thead>
    <tbody>
      ${data.rundown
        .map(
          (r) => `
      <tr>
        <td>${escapeHtml(r.time)}</td>
        <td>${escapeHtml(r.duration)}</td>
        <td>${escapeHtml(r.activity)}</td>
        <td>${escapeHtml(r.pic)}</td>
        <td>${escapeHtml(r.notes)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>

  <h3>8.1 Teknis Acara</h3>
  <p>${escapeHtml(data.techEvent).replace(/\n/g, "<br/>")}</p>

  <h3>8.2 Teknis Sesi Khusus / Candle Light Service</h3>
  <p>${escapeHtml(data.techSpecialSession).replace(/\n/g, "<br/>")}</p>

  <h3>8.3 Teknis Penampilan &amp; Transisi MC</h3>
  <p>${escapeHtml(data.techPerformance).replace(/\n/g, "<br/>")}</p>

  <h2>9. Lembar Pengesahan</h2>
  <table class="sign-table">
    <tr>
      <td>Ketua Panitia<br/><br/><br/><br/><strong>(${escapeHtml(data.approverLeader)})</strong></td>
      <td>Sekretaris<br/><br/><br/><br/><strong>(${escapeHtml(data.approverSecretary)})</strong></td>
      <td>Bendahara<br/><br/><br/><br/><strong>(${escapeHtml(data.approverTreasurer)})</strong></td>
      <td>Mengetahui,<br/>Gembala / Pembina<br/><br/><br/><strong>(${escapeHtml(data.approverPastor)})</strong></td>
    </tr>
  </table>
</body>
</html>`;

  const blob = new Blob(["\ufeff", html], {
    type: "application/msword",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = (data.title || "Proposal_Acara")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  link.href = url;
  link.download = `${slug || "proposal_acara"}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
