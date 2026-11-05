// Crea las tablas en las 5 bases de datos (no borra nada si ya existen).
//
// Uso: node scripts/tablas.mjs --local     (bases de prueba en su computadora)
//      node scripts/tablas.mjs --remote    (bases reales en Cloudflare)

import { execFileSync } from "node:child_process";

const donde = process.argv.includes("--remote") ? "--remote" : "--local";
const windows = process.platform === "win32";
const wrangler = (...args) => execFileSync("npx", ["wrangler", ...args], { stdio: "inherit", shell: windows });

wrangler("d1", "execute", "carnet-adep", donde, "--file=schema.sql");
for (let n = 1; n <= 4; n++) {
  wrangler("d1", "execute", `carnet-adep-fotos-${n}`, donde, "--file=schema-fotos.sql");
}
console.log(`\nListo: tablas creadas en las 5 bases de datos (${donde === "--remote" ? "Cloudflare" : "prueba local"}).`);
