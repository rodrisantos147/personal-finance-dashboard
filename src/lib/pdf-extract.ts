/**
 * Extracción de texto desde PDF en el navegador (pdf.js).
 * Ordena los fragmentos por posición para acercarse al orden de lectura (tablas).
 */

type TextItem = { str: string; transform: number[] };

function clusterItemsIntoLines(items: TextItem[], yThreshold = 5): string[] {
  const f = items.filter((i) => i.str?.trim());
  if (f.length === 0) return [];

  f.sort((a, b) => {
    const dy = b.transform[5] - a.transform[5];
    if (Math.abs(dy) > yThreshold * 0.6) return dy;
    return a.transform[4] - b.transform[4];
  });

  const lines: string[][] = [];
  let bucket: TextItem[] = [];
  let bucketY: number | null = null;

  for (const it of f) {
    const y = it.transform[5];
    if (bucketY === null) {
      bucketY = y;
      bucket = [it];
      continue;
    }
    if (Math.abs(y - bucketY) <= yThreshold) {
      bucket.push(it);
    } else {
      bucket.sort((a, b) => a.transform[4] - b.transform[4]);
      lines.push(bucket.map((i) => i.str));
      bucket = [it];
      bucketY = y;
    }
  }
  if (bucket.length) {
    bucket.sort((a, b) => a.transform[4] - b.transform[4]);
    lines.push(bucket.map((i) => i.str));
  }

  return lines.map((parts) => parts.join(" ").replace(/\s+/g, " ").trim()).filter(Boolean);
}

export async function extractTextFromPdfFile(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  return extractTextFromPdfBuffer(data);
}

export async function extractTextFromPdfBuffer(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const v = pdfjs.version;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${v}/build/pdf.worker.min.mjs`;

  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as TextItem[];
    const lines = clusterItemsIntoLines(items, 6);
    pageLines.push(...lines);
  }

  return pageLines.join("\n");
}
