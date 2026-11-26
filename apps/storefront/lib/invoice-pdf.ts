/**
 * A minimal, dependency-free PDF writer for order invoices.
 *
 * Why hand-rolled: attaching a PDF to a customer email must not add a rendering
 * service, a headless Chrome or a 2 MB library to a shop that otherwise has none
 * of those. This emits a plain PDF 1.4 document with the standard Helvetica
 * fonts, which every mail client and phone can open.
 *
 * Scope, honestly stated:
 *   - Latin-1 text only. The rupee sign is not in the PDF standard encoding, so
 *     amounts are written as "Rs. 12,500" rather than "₹12,500".
 *   - No images, no embedded fonts, no compression.
 *   - A4, single column, automatic page breaks for long orders.
 *
 * The output is deterministic for the same input, which is what makes it
 * testable: tests assert the byte structure and the presence of the fields a
 * customer needs to see (number, date, totals).
 */

export interface InvoiceLine {
  title: string;
  variant?: string | null;
  quantity: number;
  /** Line total in major units (rupees), already tax-inclusive. */
  amount: number;
}

export interface InvoiceFacts {
  invoiceNumber: string;
  issuedAt: string; // ISO date
  orderReference: string;
  seller: {
    name: string;
    addressLines: string[];
    state?: string | null;
    /** Printed only when the seller is registered; never faked or announced. */
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  buyer: {
    name: string;
    email?: string | null;
    addressLines: string[];
    phone?: string | null;
  };
  lines: InvoiceLine[];
  currencySymbol: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  /** Present only when the seller is registered; otherwise the doc says so. */
  taxNote?: string | null;
  paymentReference?: string | null;
  notes?: string[];
}

/* ------------------------------------------------------------------ *
 * PDF primitives
 * ------------------------------------------------------------------ */

/** PDF strings are Latin-1 with three characters that must be escaped. */
function escapePdfText(value: string): string {
  return value
    .normalize("NFKD")
    // Anything outside Latin-1 (rupee, em dash, curly quotes) becomes an ASCII
    // stand-in, so the file never contains a byte the standard font cannot draw.
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, (ch) =>
      ch === "₹"
        ? "Rs."
        : ch === "–" || ch === "—"
          ? "-"
          : ch === "’" || ch === "‘"
            ? "'"
            : ch === "“" || ch === "”"
              ? '"'
              : "?"
    )
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

const PAGE_WIDTH = 595; // A4 points
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const BOTTOM_LIMIT = 90;

interface TextOp {
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  text: string;
  maxWidth?: number;
}

function wrap(text: string, maxWidth: number, size: number): string[] {
  // Helvetica averages ~0.5em per character; good enough for wrapping addresses
  // without embedding font metrics.
  const perLine = Math.max(12, Math.floor(maxWidth / (size * 0.5)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > perLine && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function money(symbol: string, value: number): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number(value) || 0);
  return `${symbol} ${formatted}`.replace(symbol === "Rs." ? "Rs. " : symbol, symbol === "Rs." ? "Rs. " : symbol);
}

/** Build the page content streams. One stream per page. */
function buildPages(facts: InvoiceFacts): string[] {
  const pages: TextOp[][] = [];
  let ops: TextOp[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const push = (op: TextOp) => {
    if (op.y < BOTTOM_LIMIT) {
      pages.push(ops);
      ops = [];
      y = PAGE_HEIGHT - MARGIN;
      op = { ...op, y };
    }
    ops.push(op);
    return op.y;
  };

  /**
   * Draw text that must not run past `maxWidth`, one line at a time, and return
   * the next y.
   *
   * Without this, a long seller address simply kept going and collided with the
   * INVOICE / No. / Date block on the right — visible in the very first real
   * invoice this printer produced.
   */
  const pushWrapped = (
    x: number,
    startY: number,
    size: number,
    text: string,
    maxWidth: number,
    bold = false
  ): number => {
    let cursor = startY;
    for (const line of wrap(text, maxWidth, size)) {
      push({ x, y: cursor, size, text: line, bold });
      cursor -= size + 3;
    }
    return cursor;
  };

  const sym = facts.currencySymbol || "Rs.";

  // Masthead. The left column is capped so it can never reach the metadata
  // block on the right, however long the registered address is.
  push({ x: MARGIN, y, size: 18, bold: true, text: facts.seller.name || "Seller" });
  y -= 22;
  for (const line of facts.seller.addressLines) {
    y = pushWrapped(MARGIN, y, 9, line, 300);
  }
  // Contact details are what a customer actually needs from the masthead. The
  // GSTIN line appears only when the seller is registered: printing "not
  // registered" on every invoice is a disclaimer, not information.
  const contactBits = [
    facts.seller.phone ? `Tel ${facts.seller.phone}` : "",
    facts.seller.email || "",
    facts.seller.website || "",
  ].filter(Boolean);
  if (contactBits.length) {
    y = pushWrapped(MARGIN, y, 8.5, contactBits.join("  ·  "), 300);
    y -= 2;
  }
  if (facts.seller.gstin) {
    push({ x: MARGIN, y, size: 8.5, text: `GSTIN: ${facts.seller.gstin}` });
    y -= 11;
  }

  // Document title, right aligned block
  push({ x: PAGE_WIDTH - MARGIN - 150, y: PAGE_HEIGHT - MARGIN, size: 14, bold: true, text: "INVOICE" });
  push({ x: PAGE_WIDTH - MARGIN - 150, y: PAGE_HEIGHT - MARGIN - 18, size: 9, text: `No. ${facts.invoiceNumber}` });
  push({ x: PAGE_WIDTH - MARGIN - 150, y: PAGE_HEIGHT - MARGIN - 30, size: 9, text: `Date: ${facts.issuedAt.slice(0, 10)}` });
  push({ x: PAGE_WIDTH - MARGIN - 150, y: PAGE_HEIGHT - MARGIN - 42, size: 9, text: `Order: ${facts.orderReference}` });

  y -= 14;
  ops.push({ x: MARGIN, y, size: 1, text: "" }); // spacer anchor
  y -= 6;

  // Buyer block
  push({ x: MARGIN, y, size: 8, bold: true, text: "BILL TO" });
  y -= 14;
  push({ x: MARGIN, y, size: 10, bold: true, text: facts.buyer.name || "Customer" });
  y -= 13;
  for (const line of facts.buyer.addressLines.slice(0, 3)) {
    y = pushWrapped(MARGIN, y, 9, line, 300);
  }
  if (facts.buyer.phone) {
    push({ x: MARGIN, y, size: 9, text: `Phone: ${facts.buyer.phone}` });
    y -= 12;
  }
  if (facts.buyer.email) {
    push({ x: MARGIN, y, size: 9, text: facts.buyer.email });
    y -= 12;
  }

  // Table header
  y -= 10;
  push({ x: MARGIN, y, size: 8, bold: true, text: "ITEM" });
  push({ x: 380, y, size: 8, bold: true, text: "QTY" });
  push({ x: 430, y, size: 8, bold: true, text: "AMOUNT" });
  y -= 6;
  ops.push({ x: MARGIN, y, size: 1, text: "__RULE__" });
  y -= 16;

  for (const line of facts.lines) {
    const label = line.variant ? `${line.title} — ${line.variant}` : line.title;
    const wrapped = wrap(label, 280, 10);
    push({ x: MARGIN, y, size: 10, text: wrapped[0] });
    push({ x: 380, y, size: 10, text: String(line.quantity) });
    push({ x: 430, y, size: 10, text: money(sym, line.amount) });
    y -= 13;
    for (const extra of wrapped.slice(1)) {
      push({ x: MARGIN, y, size: 8, text: extra });
      y -= 11;
    }
  }

  // Totals
  y -= 6;
  ops.push({ x: MARGIN, y, size: 1, text: "__RULE__" });
  y -= 18;

  const totals: [string, string][] = [
    ["Subtotal", money(sym, facts.subtotal)],
    ["Shipping", money(sym, facts.shipping)],
  ];
  if (facts.discount > 0) totals.push(["Discount", `- ${money(sym, facts.discount)}`]);
  totals.push(["Total paid", money(sym, facts.total)]);

  for (const [label, value] of totals) {
    const bold = label === "Total paid";
    push({ x: 380, y, size: bold ? 11 : 9, bold, text: label });
    push({ x: 470, y, size: bold ? 11 : 9, bold, text: value });
    y -= 14;
  }

  y -= 8;
  const notes = [
    facts.taxNote || null,
    facts.paymentReference ? `Payment reference: ${facts.paymentReference}` : null,
    ...(facts.notes || []),
  ].filter(Boolean) as string[];

  for (const note of notes) {
    for (const line of wrap(note, PAGE_WIDTH - MARGIN * 2, 8)) {
      push({ x: MARGIN, y, size: 8, text: line });
      y -= 11;
    }
  }

  pages.push(ops);

  return pages.map((pageOps, pageIndex) => {
    const parts: string[] = [];
    for (const op of pageOps) {
      if (op.text === "__RULE__") {
        parts.push(`0.86 0.80 0.71 RG 0.6 w ${op.x} ${op.y} m ${PAGE_WIDTH - MARGIN} ${op.y} l S`);
        continue;
      }
      if (!op.text.trim()) continue;
      parts.push(
        `BT /${op.bold ? "F2" : "F1"} ${op.size} Tf 0.16 0.13 0.12 rg 1 0 0 1 ${op.x} ${op.y} Tm (${escapePdfText(
          op.text
        )}) Tj ET`
      );
    }

    // Footer on every page: a printed or forwarded invoice should still say
    // where it came from and which page of the document it is.
    const footerY = MARGIN - 14;
    parts.push(
      `0.86 0.80 0.71 RG 0.5 w ${MARGIN} ${footerY + 10} m ${PAGE_WIDTH - MARGIN} ${footerY + 10} l S`
    );
    const footerLeft = [facts.seller.name, facts.seller.website, facts.seller.phone]
      .filter(Boolean)
      .join("  ·  ");
    const footerRight = `Page ${pageIndex + 1} of ${pages.length}`;
    if (footerLeft) {
      parts.push(
        `BT /F1 7.5 Tf 0.45 0.40 0.36 rg 1 0 0 1 ${MARGIN} ${footerY} Tm (${escapePdfText(footerLeft)}) Tj ET`
      );
    }
    parts.push(
      `BT /F1 7.5 Tf 0.45 0.40 0.36 rg 1 0 0 1 ${PAGE_WIDTH - MARGIN - 52} ${footerY} Tm (${escapePdfText(
        footerRight
      )}) Tj ET`
    );

    return parts.join("\n");
  });
}

/* ------------------------------------------------------------------ *
 * Document assembly
 * ------------------------------------------------------------------ */

export function buildInvoicePdf(facts: InvoiceFacts): Buffer {
  const contents = buildPages(facts);
  const pageCount = contents.length;

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  // 1 Catalog, 2 Pages, then per page: page object + content stream,
  // then the two fonts.
  const catalogNum = add("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesNum = add(""); // filled in below once page objects exist
  const font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const pageNums: number[] = [];
  for (const stream of contents) {
    const contentNum = add(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`
    );
    const pageNum = add(
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> ` +
        `/Contents ${contentNum} 0 R >>`
    );
    pageNums.push(pageNum);
  }

  objects[pagesNum - 1] =
    `<< /Type /Pages /Count ${pageCount} /Kids [${pageNums
      .map((n) => `${n} 0 R`)
      .join(" ")}] >>`;

  // Serialise with a real xref table: offsets are counted in bytes from the
  // start of the file, so the header must be written before anything else.
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  let body = "";
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header, "latin1");

  objects.forEach((content, index) => {
    const chunk = `${index + 1} 0 obj\n${content}\nendobj\n`;
    offsets.push(cursor);
    body += chunk;
    cursor += Buffer.byteLength(chunk, "latin1");
  });

  const xrefStart = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, "latin1");
}

/** Filename a customer can recognise in their inbox. */
export function invoiceFileName(invoiceNumber: string): string {
  const safe = String(invoiceNumber || "invoice").replace(/[^A-Za-z0-9._-]/g, "-");
  return `SnehaVrinda-Invoice-${safe}.pdf`;
}
