// POST /api/crear  { cedula, nombre, filial, nacimiento }
// Crea el carnet si la cédula está en la lista de afiliados activos de ADEP.

import {
  json, leerCuerpo, leerCedula, leerFecha, estaBloqueado, registrarFallo,
  esAfiliadoActivo, datosCarnet, MENSAJE_BLOQUEO
} from "../../lib/comun.js";

export async function onRequestPost({ request, env }) {
  const cuerpo = await leerCuerpo(request);
  const cedula = leerCedula(cuerpo.cedula);
  const nombre = String(cuerpo.nombre ?? "").trim().replace(/\s+/g, " ");
  const filial = String(cuerpo.filial ?? "").trim();
  const nacimiento = leerFecha(cuerpo.nacimiento);

  if (!cedula) return json({ error: "Ingrese una cédula de 9 dígitos." }, 400);
  if (nombre.length < 5 || nombre.length > 80 || !nombre.includes(" ")) {
    return json({ error: "Escriba su nombre completo (nombre y apellidos)." }, 400);
  }
  if (!nacimiento) return json({ error: "Elija su fecha de nacimiento completa." }, 400);

  if (await estaBloqueado(env, request)) return json({ error: MENSAJE_BLOQUEO }, 429);

  const filialValida = await env.DB
    .prepare("SELECT 1 FROM filiales WHERE nombre = ?")
    .bind(filial)
    .first();
  if (!filialValida) return json({ error: "Elija su filial de la lista." }, 400);

  if (!(await esAfiliadoActivo(env, cedula))) {
    await registrarFallo(env, request);
    return json({ estado: "no-afiliado" });
  }

  const existente = await env.DB
    .prepare("SELECT 1 FROM carnets WHERE cedula = ?")
    .bind(cedula)
    .first();
  if (existente) return json({ estado: "ya-existe" });

  const carnet = {
    cedula,
    nombre,
    filial,
    nacimiento,
    token: crypto.randomUUID(),
    creado: new Date().toISOString().slice(0, 10)
  };

  await env.DB
    .prepare("INSERT INTO carnets (cedula, nombre, filial, nacimiento, token, creado) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(carnet.cedula, carnet.nombre, carnet.filial, carnet.nacimiento, carnet.token, carnet.creado)
    .run();

  return json({ estado: "ok", carnet: datosCarnet(carnet) });
}
