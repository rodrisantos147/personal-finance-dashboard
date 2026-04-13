/**
 * Extrae texto de un PDF (Node) para inspeccionar extractos. Uso:
 * node scripts/dump-pdf-text.mjs "ruta/al/archivo.pdf" [maxChars]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pdfPath = process.argv[2];
const maxChars = Number(process.argv[3]) || 120_000;

if (!pdfPath) {
  console.error("Uso: node scripts/dump-pdf-text.mjs <archivo.pdf>");
  process.exit(1);
}

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjsLib.getDocument({ data }).promise;
let out = "";

for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p);
  const content = await page.getTextContent();
  const items = content.items;
  for (const it of items) {
    if (it.str) out += it.str + " ";
  }
  out += "\n---PAGE " + p + "---\n";
}

console.log(out.slice(0, maxChars));
