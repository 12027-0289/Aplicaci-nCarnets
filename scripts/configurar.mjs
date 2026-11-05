// Prepara Cloudflare la primera vez: crea las 5 bases de datos D1, anota sus IDs en wrangler.toml
// y crea las tablas. Antes, inicie sesión con: npx wrangler login
//
// Uso: npm run configurar
//
// Se puede volver a correr: las bases que ya tienen su ID real en wrangler.toml no se vuelven a crear.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const windows = process.platform === "win32";
const PROVISIONAL = /^00000000-0000-0000-0000-0000000000\d\d$/;

let toml = readFileSync("wrangler.toml", "utf8");
const bases = [...toml.matchAll(/database_name\s*=\s*"([^"]+)"\s*\r?\ndatabase_id\s*=\s*"([^"]+)"/g)]
  .map(m => ({ nombre: m[1], id: m[2] }));

for (const base of bases) {
  if (!PROVISIONAL.test(base.id)) {
    console.log(`✓ ${base.nombre} ya existe (${base.id})`);
    continue;
  }
  console.log(`Creando ${base.nombre}…`);
  // enam = este de Norteamérica (la región más cercana a Costa Rica). Sin preguntas ni cambios automáticos.
  const salida = execFileSync("npx", ["wrangler", "d1", "create", base.nombre, "--location", "enam", "--update-config=false"],
    { encoding: "utf8", shell: windows, stdio: ["ignore", "pipe", "inherit"] });
  const id = salida.match(/"?database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/)?.[1];
  if (!id) {
    console.error(salida);
    console.error(`\nNo se encontró el ID de ${base.nombre} en la respuesta de Cloudflare.`);
    console.error("Cópielo de lo que aparece arriba y péguelo a mano en wrangler.toml, en lugar de " + base.id);
    process.exit(1);
  }
  toml = toml.replace(base.id, id);
  writeFileSync("wrangler.toml", toml);      // se guarda después de cada una, por si algo falla a medias
  console.log(`✓ ${base.nombre} creada (${id})`);
}

console.log("\nCreando las tablas…");
execFileSync(process.execPath, ["scripts/tablas.mjs", "--remote"], { stdio: "inherit" });
console.log("\nListo. Ahora suba la lista de afiliados (npm run importar y npm run db:subir) y publique (npm run publicar).");
