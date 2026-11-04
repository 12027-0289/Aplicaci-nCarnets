// GET /api/filiales  → lista de filiales para el formulario de "Crear mi carnet"

import { json } from "../../lib/comun.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare("SELECT nombre FROM filiales")
    .all();
  const filiales = results.map(f => f.nombre).sort((a, b) => a.localeCompare(b, "es"));
  return json({ filiales });
}
