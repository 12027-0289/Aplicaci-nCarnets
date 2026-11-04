// POST /api/carnet  { token }
// Para "recordar en este celular": devuelve el carnet guardado si el afiliado sigue activo.

import { json, leerCuerpo, estaBloqueado, registrarFallo, datosCarnet, MENSAJE_BLOQUEO } from "../../lib/comun.js";

export async function onRequestPost({ request, env }) {
  const { token } = await leerCuerpo(request);
  if (typeof token !== "string" || token.length !== 36) return json({ estado: "invalido" }, 401);

  if (await estaBloqueado(env, request)) return json({ error: MENSAJE_BLOQUEO }, 429);

  const carnet = await env.DB
    .prepare(`SELECT c.* FROM carnets c
              JOIN afiliados a ON a.cedula = c.cedula AND a.activo = 1
              WHERE c.token = ?`)
    .bind(token)
    .first();

  if (!carnet) {
    await registrarFallo(env, request);
    return json({ estado: "invalido" }, 401);
  }

  return json({ estado: "ok", carnet: await datosCarnet(env, carnet) });
}
