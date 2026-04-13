/**
 * Verificación local: npx tsx scripts/verify-itau.ts <ruta.pdf>
 */
import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseItauStatementFromPdfText } from "../src/lib/itau-statement";

async function extractText(data: Uint8Array): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let out = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as { str?: string }[]) {
      if (it.str) out += it.str + " ";
    }
    out += "\n";
  }
  return out;
}

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Uso: npx tsx scripts/verify-itau.ts <archivo.pdf>");
  process.exit(1);
}

void (async () => {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const text = await extractText(data);
  const r = parseItauStatementFromPdfText(text);
  console.log(
    "ok:",
    r.ok,
    "rows:",
    r.ok ? r.rows.length : 0,
    "skipped:",
    r.ok ? r.skipped : "—",
  );
  if (r.ok && r.rows.length > 0) {
    console.log(
      "muestra:",
      r.rows
        .slice(0, 5)
        .map(
          (x) =>
            `${x.date} ${x.description.slice(0, 40)} ${x.amount} ${x.currency}`,
        ),
    );
  }
})();
