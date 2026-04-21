// Postbuild: emit a static index.html into dist/client so static hosts (Vercel, Netlify) can serve the SPA.
// TanStack Start's default build targets a Worker SSR runtime and does NOT emit index.html.
// We discover the client entry chunk + CSS from the server-side Vite manifest and inline them.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const clientDir = join(root, "dist", "client");
const assetsDir = join(clientDir, "assets");

if (!existsSync(assetsDir)) {
  console.error("[postbuild] dist/client/assets not found — skipping index.html generation");
  process.exit(0);
}

const files = readdirSync(assetsDir);

// Heuristic: the largest index-*.js is the client entry; the styles-*.css is the global stylesheet.
const entryCandidates = files
  .filter((f) => /^index-.*\.js$/.test(f))
  .map((f) => ({ f, size: readFileSync(join(assetsDir, f)).length }))
  .sort((a, b) => b.size - a.size);

const cssCandidates = files
  .filter((f) => /^styles-.*\.css$/.test(f))
  .map((f) => ({ f, size: readFileSync(join(assetsDir, f)).length }))
  .sort((a, b) => b.size - a.size);

if (entryCandidates.length === 0) {
  console.error("[postbuild] no client entry chunk found");
  process.exit(1);
}

const entry = entryCandidates[0].f;
const css = cssCandidates[0]?.f;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SCOE Pambula Michika — Result Portal</title>
    <meta name="description" content="Shallom College of Education, Pambula Michika — result management portal" />
    <link rel="icon" href="/favicon.ico" />
    ${css ? `<link rel="stylesheet" href="/assets/${css}" />` : ""}
    <script type="module" crossorigin src="/assets/${entry}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), html);
console.log(`[postbuild] wrote dist/client/index.html (entry=${entry}, css=${css ?? "none"})`);
