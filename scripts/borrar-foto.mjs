// Borra la foto de un afiliado (por ejemplo, si subió una foto inadecuada).
// La próxima vez que abra su carnet, la página le pedirá tomarse una foto nueva.
//
// Uso:   npm run borrar-foto -- 1-0234-0567            (en Cloudflare)
//        npm run borrar-foto -- 1-0234-0567 --local    (en la prueba local)

import { execFileSync } from "node:child_process";

const cedula = String(process.argv[2] ?? "").replace(/\D/g, "");
const donde = process.argv.includes("--local") ? "--local" : "--remote";

if (cedula.length !== 9) {
  console.error("Escriba la cédula del afiliado. Ejemplo: npm run borrar-foto -- 1-0234-0567");
  process.exit(1);
}

// En Windows, npx necesita la terminal (shell) y el texto con espacios va entre comillas.
const windows = process.platform === "win32";
const wrangler = (...args) => execFileSync("npx", ["wrangler", ...args], { stdio: "inherit", shell: windows });
const sql = `UPDATE carnets SET foto = NULL WHERE cedula = '${cedula}'`;

wrangler("d1", "execute", "carnet-adep", donde, "--command", windows ? `"${sql}"` : sql);
wrangler("r2", "object", "delete", `carnet-adep-fotos/fotos/${cedula}.jpg`, donde);

console.log(`\nListo: se borró la foto de la cédula ${cedula}. Se le pedirá una nueva al abrir su carnet.`);
