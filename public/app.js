const $ = id => document.getElementById(id);
const pasos = ["paso-cargando", "paso-inicio", "paso-ingresar", "paso-crear", "paso-aviso", "paso-carnet"];

const CLAVE_TOKEN = "carnet-adep-token";
const WHATSAPP = "https://wa.me/50687227777?text=" + encodeURIComponent("Hola, quisiera afiliarme a ADEP.");
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
               "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function mostrar(paso) {
  pasos.forEach(p => $(p).classList.toggle("oculto", p !== paso));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- "Recordar en este celular" (puede fallar en modo privado) ---
const token = {
  leer() { try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; } },
  guardar(valor) { try { localStorage.setItem(CLAVE_TOKEN, valor); } catch {} },
  borrar() { try { localStorage.removeItem(CLAVE_TOKEN); } catch {} }
};

// --- Cédula ---
const soloDigitos = v => v.replace(/\D/g, "").slice(0, 9);
const formatoCedula = d => [d.slice(0, 1), d.slice(1, 5), d.slice(5, 9)].filter(Boolean).join("-");

document.querySelectorAll("input.cedula").forEach(input => input.addEventListener("input", () => {
  input.value = formatoCedula(soloDigitos(input.value));
}));

// --- Fecha de nacimiento con tres listas: día, mes y año ---
function crearSelectorFecha(contenedor) {
  const opcion = (valor, texto) => `<option value="${valor}">${texto}</option>`;
  const anioActual = new Date().getFullYear();
  const dias = Array.from({ length: 31 }, (_, i) => opcion(i + 1, i + 1)).join("");
  const meses = MESES.map((m, i) => opcion(i + 1, m)).join("");
  const anios = Array.from({ length: anioActual - 18 - 1920 + 1 }, (_, i) => anioActual - 18 - i)
    .map(a => opcion(a, a)).join("");

  contenedor.innerHTML = `
    <select aria-label="Día" data-parte="dia"><option value="">Día</option>${dias}</select>
    <select aria-label="Mes" data-parte="mes"><option value="">Mes</option>${meses}</select>
    <select aria-label="Año" data-parte="anio"><option value="">Año</option>${anios}</select>`;

  return {
    // Devuelve AAAA-MM-DD, o null si falta algo o la fecha no existe (por ejemplo, 31 de abril).
    valor() {
      const [d, m, a] = ["dia", "mes", "anio"].map(p => Number(contenedor.querySelector(`[data-parte=${p}]`).value));
      if (!d || !m || !a) return null;
      const fecha = new Date(a, m - 1, d);
      if (fecha.getMonth() !== m - 1) return null;
      return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  };
}

const fechaIngresar = crearSelectorFecha($("ingresar-fecha"));
const fechaCrear = crearSelectorFecha($("crear-fecha"));

// --- Filiales ---
async function cargarFiliales() {
  try {
    const res = await fetch("/api/filiales");
    const { filiales } = await res.json();
    const select = $("crear-filial");
    filiales.forEach(f => select.add(new Option(f, f)));
  } catch {
    // Si falla, el servidor avisará al intentar crear el carnet.
  }
}

// --- Navegación ---
document.querySelectorAll("[data-ir]").forEach(b => b.addEventListener("click", () => irA(b.dataset.ir)));

function irA(paso) {
  // Pasar la cédula escrita de un formulario al otro
  const escrita = $("ingresar-cedula").value || $("crear-cedula").value;
  if (paso === "paso-ingresar" && !$("ingresar-cedula").value) $("ingresar-cedula").value = escrita;
  if (paso === "paso-crear" && !$("crear-cedula").value) $("crear-cedula").value = escrita;
  document.querySelectorAll(".error-form").forEach(e => e.classList.add("oculto"));
  mostrar(paso);
}

// --- Avisos ---
function aviso({ icono = "!", titulo, texto, acciones }) {
  $("aviso-icono").textContent = icono;
  $("aviso-titulo").textContent = titulo;
  $("aviso-texto").textContent = texto;
  const contenedor = $("aviso-acciones");
  contenedor.innerHTML = "";
  acciones.forEach(({ texto, clase, ir, href }) => {
    const el = document.createElement(href ? "a" : "button");
    el.className = "btn " + clase;
    el.textContent = texto;
    if (href) { el.href = href; el.target = "_blank"; el.rel = "noopener"; }
    else { el.type = "button"; el.addEventListener("click", () => irA(ir)); }
    contenedor.appendChild(el);
  });
  mostrar("paso-aviso");
}

const avisoNoAfiliado = () => aviso({
  titulo: "No encontramos su afiliación",
  texto: "Esta cédula no aparece como afiliado activo de ADEP. Si desea afiliarse o cree que es un error, escríbanos por WhatsApp.",
  acciones: [
    { texto: "Escribir por WhatsApp", clase: "btn-whatsapp", href: WHATSAPP },
    { texto: "Revisar la cédula", clase: "btn-secundario", ir: "paso-inicio" }
  ]
});

// --- Mostrar el carnet ---
function iniciales(nombre) {
  const partes = nombre.split(" ").filter(Boolean);
  // Primer nombre + primer apellido (penúltima palabra cuando hay dos apellidos)
  const apellido = partes.length >= 3 ? partes[partes.length - 2] : partes[partes.length - 1];
  return (partes[0][0] + (apellido ?? "")[0]).toUpperCase();
}

function mostrarCarnet(carnet) {
  const [a, m, d] = carnet.creado.split("-");
  const valores = {
    nombre: carnet.nombre,
    cedula: formatoCedula(carnet.cedula),
    filial: carnet.filial,
    iniciales: iniciales(carnet.nombre),
    emitido: `Emitido: ${d}/${m}/${a}`
  };
  document.querySelectorAll("[data-campo]").forEach(el => {
    el.textContent = valores[el.dataset.campo];
  });
  $("saludo").textContent = "¡Hola, " + carnet.nombre.split(" ")[0] + "!";
  mostrar("paso-carnet");
}

// --- Enviar formularios ---
async function enviar(form, url, datos) {
  const error = form.querySelector(".error-form");
  const btn = form.querySelector("button[type=submit]");
  const textoBtn = btn.textContent;
  error.classList.add("oculto");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Un momento…';

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });
    const respuesta = await res.json();
    if (respuesta.error) mostrarError(form, respuesta.error);
    return respuesta;
  } catch {
    mostrarError(form, "No se pudo conectar. Revise su internet e intente de nuevo.");
    return {};
  } finally {
    btn.disabled = false;
    btn.textContent = textoBtn;
  }
}

function mostrarError(form, mensaje) {
  const error = form.querySelector(".error-form");
  error.textContent = mensaje;
  error.classList.remove("oculto");
}

function terminar(form, carnet, recordar) {
  if (recordar) token.guardar(carnet.token);
  else token.borrar();
  form.reset();
  mostrarCarnet(carnet);
}

$("form-ingresar").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const cedula = soloDigitos($("ingresar-cedula").value);
  const nacimiento = fechaIngresar.valor();

  if (cedula.length !== 9) return mostrarError(form, "Escriba su cédula completa (9 dígitos).");
  if (!nacimiento) return mostrarError(form, "Elija el día, el mes y el año de su nacimiento.");

  const r = await enviar(form, "/api/ingresar", { cedula, nacimiento });
  if (r.estado === "ok") terminar(form, r.carnet, $("ingresar-recordar").checked);
  else if (r.estado === "no-afiliado") avisoNoAfiliado();
  else if (r.estado === "fecha-incorrecta") mostrarError(form, "La fecha de nacimiento no coincide con la que registró al crear su carnet.");
  else if (r.estado === "sin-carnet") aviso({
    icono: "✨",
    titulo: "Todavía no ha creado su carnet",
    texto: "Su cédula está en la lista de afiliados, pero aún no ha creado su carnet. Es rápido: solo complete sus datos.",
    acciones: [{ texto: "Crear mi carnet", clase: "btn-principal", ir: "paso-crear" }]
  });
});

$("form-crear").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const cedula = soloDigitos($("crear-cedula").value);
  const nombre = $("crear-nombre").value.trim().replace(/\s+/g, " ");
  const filial = $("crear-filial").value;
  const nacimiento = fechaCrear.valor();

  if (cedula.length !== 9) return mostrarError(form, "Escriba su cédula completa (9 dígitos).");
  if (nombre.length < 5 || !nombre.includes(" ")) return mostrarError(form, "Escriba su nombre completo (nombre y apellidos).");
  if (!filial) return mostrarError(form, "Elija su filial.");
  if (!nacimiento) return mostrarError(form, "Elija el día, el mes y el año de su nacimiento.");

  const r = await enviar(form, "/api/crear", { cedula, nombre, filial, nacimiento });
  if (r.estado === "ok") terminar(form, r.carnet, $("crear-recordar").checked);
  else if (r.estado === "no-afiliado") avisoNoAfiliado();
  else if (r.estado === "ya-existe") aviso({
    icono: "🪪",
    titulo: "Usted ya tiene un carnet",
    texto: "Esta cédula ya tiene un carnet creado. Para verlo, use su cédula y su fecha de nacimiento. Si no fue usted quien lo creó, escríbanos por WhatsApp.",
    acciones: [
      { texto: "Ver mi carnet", clase: "btn-principal", ir: "paso-ingresar" },
      { texto: "Escribir por WhatsApp", clase: "btn-whatsapp", href: WHATSAPP }
    ]
  });
});

// --- Carnet: formato, descarga y salir ---
document.querySelectorAll("[data-formato]").forEach(b => b.addEventListener("click", () => {
  const vertical = b.dataset.formato === "v";
  $("carnet-v").classList.toggle("oculto", !vertical);
  $("carnet-h").classList.toggle("oculto", vertical);
  document.querySelectorAll("[data-formato]").forEach(x => x.classList.toggle("activo-sel", x === b));
}));

$("btn-descargar").addEventListener("click", async () => {
  if (typeof html2canvas === "undefined") {
    alert("No se pudo cargar la herramienta de descarga. Puede usar Imprimir → Guardar como PDF.");
    return;
  }
  const visible = $("carnet-h").classList.contains("oculto") ? $("carnet-v") : $("carnet-h");
  const canvas = await html2canvas(visible, { scale: 3, backgroundColor: null });
  const enlace = document.createElement("a");
  enlace.download = "carnet-adep.png";
  enlace.href = canvas.toDataURL("image/png");
  enlace.click();
});

$("btn-salir").addEventListener("click", () => {
  token.borrar();
  mostrar("paso-inicio");
});

// --- Al abrir la página: si este celular recuerda un carnet, mostrarlo directo ---
async function iniciar() {
  cargarFiliales();
  const guardado = token.leer();
  if (!guardado) return mostrar("paso-inicio");

  try {
    const res = await fetch("/api/carnet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: guardado })
    });
    const r = await res.json();
    if (r.estado === "ok") return mostrarCarnet(r.carnet);
    if (res.status === 401) token.borrar();
  } catch {
    // Sin conexión: se muestra el inicio
  }
  mostrar("paso-inicio");
}

iniciar();
