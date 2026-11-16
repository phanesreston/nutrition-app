// Copies the barcode reader's WebAssembly binary into public/ so the app
// serves it itself instead of fetching it from a third-party CDN at runtime.
// Runs on `npm install` (postinstall).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// Resolve zxing-wasm as barcode-detector sees it, so the binary always matches the reader code.
const fromDetector = createRequire(require.resolve("barcode-detector/ponyfill"));
const readerEntry = fromDetector.resolve("zxing-wasm/reader"); // …/dist/<format>/reader/index.js
const source = path.resolve(path.dirname(readerEntry), "..", "..", "reader", "zxing_reader.wasm");
const targetDir = path.join(import.meta.dirname, "..", "public", "vendor");
mkdirSync(targetDir, { recursive: true });
copyFileSync(source, path.join(targetDir, "zxing_reader.wasm"));
console.log("Copied zxing_reader.wasm to public/vendor/");
