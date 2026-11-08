// Local resume text extraction. Loaded lazily so the popup does not bundle PDF.js/Mammoth.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth/mammoth.browser';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const clean = (t: string) =>
  t
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export async function extractText(file: Blob, mimeType: string): Promise<{ text: string; pages?: number }> {
  if (mimeType === 'text/plain') return { text: clean(await file.text()) };

  if (mimeType.includes('wordprocessingml')) {
    const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: clean(res.value) };
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      line += item.hasEOL ? '\n' : ' ';
    }
    out.push(line);
  }
  const text = clean(out.join('\n\n'));
  const pages = doc.numPages;
  await task.destroy();
  if (!text) throw new Error('No text found in this PDF. It may be a scanned image; upload a text-based PDF or DOCX.');
  return { text, pages };
}

/** Render PDF pages to canvases for preview. */
export async function renderPdfPages(file: Blob, canvasFor: (index: number) => HTMLCanvasElement | null, maxPages = 3): Promise<void> {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = canvasFor(i - 1);
    if (!canvas) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
  }
  await task.destroy();
}
