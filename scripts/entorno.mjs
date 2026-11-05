// Lee la conexión a Supabase para los scripts de ADEP.
//
//   Sin --produccion → archivo .dev.vars       (base de datos de PRUEBA; la misma que usa "npm run dev")
//   Con --produccion → archivo .env.produccion (base de datos REAL de los afiliados)
//
// Ambos archivos tienen dos líneas y NUNCA se suben a GitHub (están en .gitignore):
//   SUPABASE_URL=https://xxxxxxxx.supabase.co
//   SUPABASE_SECRET_KEY=sb_secret_...

import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { supabase } from "../lib/supabase.js";

export const produccion = process.argv.includes("--produccion") && !process.argv.includes("--prueba");
export const argumentos = process.argv.slice(2).filter(a => !a.startsWith("--"));

export function conexion() {
  const archivo = produccion ? ".env.produccion" : ".dev.vars";
  if (!existsSync(archivo)) {
    console.error(`No existe el archivo ${archivo}. Cópielo de ${archivo === ".dev.vars" ? ".dev.vars.ejemplo" : ".env.produccion.ejemplo"} y complete los datos de Supabase.`);
    process.exit(1);
  }
  const env = {};
  for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  console.log(`Base de datos: ${produccion ? "REAL (producción)" : "de prueba"} → ${env.SUPABASE_URL}`);
  return { env, db: supabase(env) };
}

export async function confirmar(pregunta, palabra) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await rl.question(`${pregunta}\nEscriba ${palabra} para continuar: `);
  rl.close();
  return respuesta.trim().toUpperCase() === palabra;
}
