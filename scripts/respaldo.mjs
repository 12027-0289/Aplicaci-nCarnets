// Descarga una copia de las 5 bases de datos (datos y fotos) a la carpeta respaldos/<fecha>/.
//
// Uso: npm run respaldo                (bases reales en Cloudflare)
//      npm run respaldo -- --local     (bases de prueba en su computadora)
//
// Para restaurar una base en una base vacía:
//   npx wrangler d1 execute <nombre-de-la-base> --remote --file=respaldos/<fecha>/<nombre-de-la-base>.sql
//
// ⚠️ Los respaldos tienen datos personales de los afiliados: guárdelos en un lugar seguro.
// La carpeta respaldos/ está excluida de Git para que nunca se suba a GitHub.

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const donde = process.argv.includes("--local") ? "--local" : "--remote";
const windows = process.platform === "win32";
const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const carpeta = `respaldos/${fecha}`;
mkdirSync(carpeta, { recursive: true });

const bases = ["carnet-adep", "carnet-adep-fotos-1", "carnet-adep-fotos-2", "carnet-adep-fotos-3", "carnet-adep-fotos-4"];
for (const base of bases) {
  console.log(`Copiando ${base}…`);
  execFileSync("npx", ["wrangler", "d1", "export", base, donde, `--output=${carpeta}/${base}.sql`], { stdio: "inherit", shell: windows });
}
console.log(`\nListo: respaldo guardado en ${carpeta}/`);
