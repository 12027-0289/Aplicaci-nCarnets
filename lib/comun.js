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

const MAX_CUERPO = 1_000_000;          // ~1 MB: alcanza para los datos + una foto comprimida

export async function leerCuerpo(request) {
  try {
    const texto = await request.text();
    if (texto.length > MAX_CUERPO) return {};
    return JSON.parse(texto);
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

// --- Fotos ---
// El celular envía la foto ya recortada y comprimida como "data:image/jpeg;base64,...".
const PREFIJO_FOTO = "data:image/jpeg;base64,";
const FOTO_MIN = 2_000;                // bytes
const FOTO_MAX = 500_000;

export const MENSAJE_CONSENTIMIENTO = "Para guardar su foto debe marcar la casilla de autorización.";

// Devuelve los bytes de la foto si es un JPEG válido de tamaño razonable, o null.
export function leerFoto(valor) {
  if (typeof valor !== "string" || !valor.startsWith(PREFIJO_FOTO)) return null;
  try {
    const binario = atob(valor.slice(PREFIJO_FOTO.length));
    if (binario.length < FOTO_MIN || binario.length > FOTO_MAX) return null;
    const bytes = Uint8Array.from(binario, c => c.charCodeAt(0));
    const esJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    return esJpeg ? bytes : null;
  } catch {
    return null;
  }
}

const claveFoto = cedula => `fotos/${cedula}.jpg`;

// Guarda (o reemplaza) la foto en R2 y anota en la base de datos cuándo se subió.
export async function guardarFoto(env, cedula, bytes) {
  await env.FOTOS.put(claveFoto(cedula), bytes, { httpMetadata: { contentType: "image/jpeg" } });
  const ahora = new Date().toISOString();
  await env.DB
    .prepare("UPDATE carnets SET foto = ?, consentimiento = ? WHERE cedula = ?")
    .bind(ahora, ahora, cedula)
    .run();
}

export async function leerFotoGuardada(env, carnet) {
  if (!carnet.foto) return null;
  const objeto = await env.FOTOS.get(claveFoto(carnet.cedula));
  if (!objeto) return null;
  const bytes = new Uint8Array(await objeto.arrayBuffer());
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return PREFIJO_FOTO + btoa(binario);
}

// --- Código de verificación (QR) ---
// Es público (va impreso en el QR), por eso es distinto del token, que es secreto.
const LETRAS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";   // sin 0/O ni 1/I para que no se confundan

function nuevoCodigo() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, b => LETRAS[b % LETRAS.length]).join("");
}

// Los carnets reciben su código la primera vez que se muestran.
async function codigoVerificacion(env, carnet) {
  if (carnet.verificacion) return carnet.verificacion;
  const codigo = nuevoCodigo();
  await env.DB
    .prepare("UPDATE carnets SET verificacion = ? WHERE cedula = ? AND verificacion IS NULL")
    .bind(codigo, carnet.cedula)
    .run();
  const fila = await env.DB.prepare("SELECT verificacion FROM carnets WHERE cedula = ?").bind(carnet.cedula).first();
  return fila.verificacion;
}

export const codigoValido = valor => typeof valor === "string" && /^[2-9A-HJ-NP-Z]{12}$/.test(valor);

// Datos que se envían al navegador para dibujar el carnet.
// La foto va incluida, así cada celular ve siempre la más reciente.
export async function datosCarnet(env, carnet) {
  return {
    cedula: carnet.cedula,
    nombre: carnet.nombre,
    filial: carnet.filial,
    creado: carnet.creado,
    token: carnet.token,
    verificacion: await codigoVerificacion(env, carnet),
    foto: await leerFotoGuardada(env, carnet)
  };
}
