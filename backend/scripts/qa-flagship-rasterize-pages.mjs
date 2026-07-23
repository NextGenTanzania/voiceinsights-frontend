import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';

const [,, key, pagesArg] = process.argv;
const pages = pagesArg.split(',').map(Number);
const pdfPath = `C:/VIA/voiceinsights-app/backend/review-evidence-full/${key}/${key}.pdf`;
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjsLib.getDocument({ data }).promise;
for (const p of pages) {
  const page = await doc.getPage(p);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const out = `C:/VIA/voiceinsights-app/backend/review-evidence-full/${key}/adhoc-p${p}.png`;
  fs.writeFileSync(out, await canvas.encode('png'));
  console.log('wrote', out);
}
