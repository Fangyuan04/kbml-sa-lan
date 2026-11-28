# OCR assets and provenance

All recognition runs inside a browser Web Worker. No image or extracted text is sent to an external OCR service. These static dependencies are served from this Site, loaded only when recognition is requested. The browser may cache the two language models in IndexedDB.

## Pinned dependencies

- **Tesseract.js 6.0.1**, Apache-2.0. Official project: https://github.com/naptha/tesseract.js. Browser library and worker obtained from https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/. License: `tesseract-LICENSE.md`; additional bundled notices: `tesseract.min.js.LICENSE.txt`, `worker.min.js.LICENSE.txt`, and the included dependency licenses.
- **Tesseract.js-core 6.0.0**, Apache-2.0. Official project: https://github.com/naptha/tesseract.js-core. Four `*.wasm.js` core variants obtained from https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/. These scripts embed their WebAssembly binaries; no additional `.wasm` file or external core fetch is required. License: `core-LICENSE`.
- **Vietnamese and English language data**, `@tesseract.js-data/vie@1.0.0` and `@tesseract.js-data/eng@1.0.0`, `4.0.0_best_int` integer LSTM models. Obtained from `https://cdn.jsdelivr.net/npm/@tesseract.js-data/<language>@1.0.0/4.0.0_best_int/<language>.traineddata.gz`. Underlying official data repository: https://github.com/naptha/tessdata, Apache-2.0 (`tessdata-LICENSE`). The npm wrapper package metadata declares MIT; original metadata is preserved in `lang-eng-package.json` and `lang-vie-package.json`.

`manifest.json` records the downloaded file sizes and SHA-256 hashes.

## Original test fixture

`demo-document.png` is newly generated synthetic text for this KBML research prototype. It is not a real certificate. It is visibly labeled as test data with no legal value. The built-in example invokes the same real OCR engine as a user-uploaded image.

## Verified behavior and limits

A local Node check used the pinned Tesseract.js 6.0.1 source, vendored core 6.0.0 and vendored language models to recognize the actual pixels of `demo-document.png`. The engine returned confidence 95/100. The conservative parser recovered the labeled registration, vessel name, certificate number, expiry and capacity. This is one synthetic fixture result, not an accuracy benchmark on real maritime documents.

The browser API accepts JPEG, PNG and WebP up to 12 MB and 40 megapixels. Images larger than 3200 pixels on a side are resized locally. PDF OCR is outside this version's scope; the application may still store and preview PDF documents separately. Recognition accuracy varies with focus, lighting, rotation, handwriting, stamps and layout. Blank/unknown fields stay blank. Every suggested value requires human comparison with its source. An OCR confidence is not a probability of document authenticity or legal validity.

Technical references: https://github.com/naptha/tesseract.js/blob/v6.0.1/docs/api.md and https://github.com/naptha/tesseract.js/blob/v6.0.1/docs/local-installation.md.
