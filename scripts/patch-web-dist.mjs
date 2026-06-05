/**
 * Expo static export omits type="module" on the main JS script tag.
 * Browsers then throw: Cannot use 'import.meta' outside a module
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (name.endsWith(".html")) files.push(p);
  }
  return files;
}

if (!statSync(dist, { throwIfNoEntry: false })?.isDirectory()) {
  console.warn("patch-web-dist: no dist/ folder — skip");
  process.exit(0);
}

let patched = 0;
for (const file of walk(dist)) {
  let html = readFileSync(file, "utf8");
  const next = html.replace(
    /<script(?![^>]*\btype=)([^>]*\ssrc="\/_expo\/[^"]+\.js"[^>]*)><\/script>/g,
    '<script type="module"$1></script>'
  );
  if (next !== html) {
    writeFileSync(file, next, "utf8");
    patched += 1;
  }
}

console.log(`patch-web-dist: updated ${patched} HTML file(s)`);
