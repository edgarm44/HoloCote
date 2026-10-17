// Copie le moteur OCR (Tesseract) et ses dictionnaires dans public/ocr/
// pour qu'ils soient servis par le site lui-même (aucun appel à un CDN tiers).
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const out = 'public/ocr';
mkdirSync(out, { recursive: true });

const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const files = [
  [join(pkgDir('tesseract.js'), 'dist/worker.min.js'), 'worker.min.js'],
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']
    .map((f) => [join(pkgDir('tesseract.js-core'), f), f]),
  [join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz'), 'eng.traineddata.gz'],
  [join(pkgDir('@tesseract.js-data/fra'), '4.0.0_best_int/fra.traineddata.gz'), 'fra.traineddata.gz'],
];
for (const [src, name] of files) {
  if (!existsSync(src)) throw new Error(`Fichier OCR introuvable : ${src}`);
  copyFileSync(src, join(out, name));
}
console.log(`OCR : ${files.length} fichiers copiés dans ${out}`);
