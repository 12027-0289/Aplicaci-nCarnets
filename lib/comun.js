// Funciones compartidas por las rutas de /api.

const MAX_INTENTOS = 10;               // intentos fallidos permitidos...
const VENTANA_MS = 15 * 60 * 1000;     // ...cada 15 minutos por IP

export function json(datos, status = 200) {
  return Response.json(datos, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export const MENSAJE_BLOQUEO = "Demasiados intentos. Espere 15 minutos e intente de nuevo.";

export async function leerCuerpo(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function leerCedula(valor) {
  const cedula = String(valor ?? "").replace(/\D/g, "");
  return cedula.length === 9 ? cedula : null;
}

// Acepta AAAA-MM-DD y verifica que la fecha exista (por ejemplo, rechaza 30 de febrero).
export function leerFecha(valor) {
  const texto = String(valor ?? "");
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [a, mes, d] = m.slice(1).map(Number);
  const fecha = new Date(Date.UTC(a, mes - 1, d));
  const valida = fecha.getUTCFullYear() === a && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === d;
  return valida && a >= 1900 && fecha < new Date() ? texto : null;
}

function ip(request) {
  return request.headers.get("CF-Connecting-IP") ?? "local";
}

export async function estaBloqueado(env, request) {
  const { fallidos } = await env.DB
    .prepare("SELECT COUNT(*) AS fallidos FROM intentos WHERE ip = ? AND fecha > ?")
    .bind(ip(request), Date.now() - VENTANA_MS)
    .first();
  return fallidos >= MAX_INTENTOS;
}

export async function registrarFallo(env, request) {
  const ahora = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO intentos (ip, fecha) VALUES (?, ?)").bind(ip(request), ahora),
    env.DB.prepare("DELETE FROM intentos WHERE fecha < ?").bind(ahora - VENTANA_MS)
  ]);
}

export async function esAfiliadoActivo(env, cedula) {
  const fila = await env.DB
    .prepare("SELECT 1 FROM afiliados WHERE cedula = ? AND activo = 1")
    .bind(cedula)
    .first();
  return Boolean(fila);
}

// Datos que se envían al navegador para dibujar el carnet.
export function datosCarnet(carnet) {
  return {
    cedula: carnet.cedula,
    nombre: carnet.nombre,
    filial: carnet.filial,
    creado: carnet.creado,
    token: carnet.token
  };
}
