# Mi Carnet ADEP

Página web donde los afiliados de ADEP crean y ven su carnet digital.

- **Crear mi carnet (primera vez):** el afiliado escribe su cédula, su nombre, elige su filial y su
  fecha de nacimiento (día, mes y año en tres listas), y **se toma una foto del rostro** con la cámara
  del celular (o la elige de sus fotos). Debe marcar la casilla de autorización para guardar su foto
  (Ley 8968). Solo se puede si la cédula está en la lista de afiliados activos de ADEP.
- **Cambiar mi foto:** desde su carnet, el afiliado puede tomarse otra foto. La nueva reemplaza a la
  anterior en todos los celulares donde abra su carnet.
- **Carnets sin foto** (creados antes, o si ADEP borró la foto): la foto es **obligatoria**. Al entrar
  se le pide tomarse una, y el carnet no se muestra hasta que la suba (también lo valida el servidor).
- **Ver mi carnet:** cédula + fecha de nacimiento.
- **Recordar en este celular:** después de entrar una vez, el carnet aparece directo al abrir la página.
- **Código QR de verificación:** el botón **"Mostrar código QR"** abre el código en grande (no va impreso
  en el carnet). Quien lo escanee (un comercio, ADEP) ve en ese momento si el carnet está **vigente**, con la foto y el nombre para compararlos con la persona. La cédula
  se muestra incompleta y nunca la fecha de nacimiento.
- **App instalable y sin internet:** se puede instalar en el celular como una app (Android: botón
  "Instalar"; iPhone: instrucciones). Si eligió "Recordar en este celular", el carnet se ve aunque no haya señal.
- **Política de privacidad** en `/privacidad` (Ley 8968), enlazada desde la autorización de la foto y el pie de página.
- El carnet (formato vertical) se puede descargar como imagen o imprimir.
- Si la cédula no está en la lista, se le ofrece escribir por WhatsApp para afiliarse.

Funciona con **Cloudflare Pages** (la página, gratis y siempre encendida) y **Supabase** (los datos y las fotos).

```
Celular del afiliado ──► Cloudflare Pages (página + funciones /api y /v) ──► Supabase
                                                                             ├─ Base de datos: tablas carnet_*
                                                                             └─ Storage: bucket privado carnet-fotos
```

El celular **nunca** se conecta a Supabase: solo el servidor de Cloudflare lo hace, con una clave secreta
guardada en Cloudflare (no en el código ni en GitHub).

## Cómo está hecho

```
public/                   → la página que ve el afiliado
  index.html
  estilos.css
  app.js
  logo.png                → logo oficial de ADEP
  privacidad.html         → política de privacidad (BORRADOR: complete lo marcado en amarillo)
  sw.js                   → guarda la página en el celular para que abra sin internet
  manifest.webmanifest    → nombre, colores e íconos de la app instalable
  iconos/                 → íconos de la app (hechos a partir de logo.png)
  vendor/                 → librerías: html2canvas (descargar imagen) y qrcode (código QR)
  _headers                → que sw.js y el manifiesto no se queden viejos en los celulares
functions/v/[codigo].js   → página que se abre al escanear el QR (/v/<código>)
functions/api/            → lo que corre en el servidor
  crear.js                → crea el carnet (si la cédula está en la lista)
  ingresar.js             → muestra el carnet con cédula + fecha de nacimiento
  foto.js                 → agrega o cambia la foto de un carnet
  carnet.js               → "recordar en este celular"
  filiales.js             → lista de filiales
lib/comun.js              → funciones compartidas
lib/supabase.js           → conexión a Supabase (base de datos y fotos)
basedatos/supabase.sql    → crea las tablas, la seguridad y el bucket de fotos en Supabase
scripts/importar.mjs      → revisa la lista de cédulas y filiales y la sube a Supabase
scripts/borrar-foto.mjs   → borra la foto de un afiliado (fotos inadecuadas)
scripts/ejemplo.mjs       → llena la base de PRUEBA con datos de ejemplo
datos/                    → ejemplos de cómo deben venir las listas
.dev.vars.ejemplo         → modelo de la conexión a la base de PRUEBA
.env.produccion.ejemplo   → modelo de la conexión a la base REAL
wrangler.toml             → configuración de Cloudflare
```

La base de datos (Supabase) tiene:

| Tabla              | Qué guarda                                           | Quién la llena             |
|--------------------|------------------------------------------------------|----------------------------|
| `carnet_afiliados` | Cédulas de los afiliados y si están activos          | ADEP (Excel o Table Editor) |
| `carnet_filiales`  | Lista de filiales                                    | ADEP                       |
| `carnet_carnets`   | Nombre, filial, fecha de nacimiento, códigos y fecha de la foto/autorización | El afiliado, al crearlo |
| `carnet_intentos`  | Intentos fallidos, para frenar a quien intente adivinar | Automático              |

Todas empiezan con `carnet_` para poder estar en el mismo proyecto de Supabase que otras tablas de ADEP.
Tienen la seguridad por filas (RLS) activada **sin políticas**: con la clave pública de Supabase no se
puede leer nada; solo el servidor, con la clave secreta.

Cada carnet tiene un **código de verificación** público (12 letras y números al azar) que va en el QR
del botón "Mostrar código QR".
Es distinto de la clave secreta que usa "Recordar en este celular" (`token`), así que escanear el QR no
permite entrar al carnet de nadie.

Las fotos están en Supabase Storage, bucket **privado** `carnet-fotos`, como `fotos/<cédula>.jpg`
(480 × 640 px, unos 50–100 KB cada una). El celular recorta y comprime la foto antes de enviarla.

Tras 10 intentos fallidos en 15 minutos desde la misma conexión, se bloquean los intentos por un rato.

---

## 1. Preparar Supabase (una sola vez)

Se recomiendan **dos** proyectos de Supabase: uno **de prueba** (para `npm run dev`) y el **real**.
Puede usar un proyecto que ADEP ya tenga: las tablas `carnet_*` no se mezclan con las demás.

> ⚠️ En el plan **gratis**, Supabase **pausa** el proyecto si pasa 7 días sin uso, y la página deja de
> funcionar hasta reactivarlo. Para el proyecto **real** conviene el plan **Pro**.

En cada proyecto:

1. Abra **SQL Editor**, pegue todo el archivo `basedatos/supabase.sql` y toque **Run**.
   Crea las tablas, la seguridad y el bucket privado de fotos. Se puede volver a correr sin perder datos.
2. En **Project Settings → API Keys** copie:
   - la **URL** del proyecto (`https://xxxx.supabase.co`)
   - una clave **secret** (`sb_secret_...`). También sirve la antigua `service_role`.
   **Nunca** use ni comparta esta clave fuera del servidor: da acceso total.

## 2. Lo que necesita instalar (una sola vez)

1. **Node.js** (versión LTS): https://nodejs.org
2. En una terminal, dentro de la carpeta del proyecto:
   ```
   npm install
   ```
3. Copie `.dev.vars.ejemplo` como **`.dev.vars`** y ponga la URL y la clave del proyecto de **prueba**.

## 3. Probarlo en su computadora

```
npm run db:ejemplo   # llena la base de PRUEBA con datos de ejemplo (borra los carnets de prueba)
npm run dev          # abre la página en http://localhost:8788
```

Datos de prueba:

| Cédula      | Fecha de nacimiento | Qué pasa                                        |
|-------------|---------------------|-------------------------------------------------|
| 1-0234-0567 | 14 marzo 1958       | Ya tiene carnet, sin foto: debe agregarla para verlo |
| 2-0456-0789 | (la que usted elija) | Afiliado sin carnet: puede crearlo             |
| 4-0111-0222 | (la que usted elija) | Afiliado sin carnet: puede crearlo             |
| 3-0321-0654 | —                   | Inactiva: "No encontramos su afiliación"        |
| Cualquier otra | —                | "No encontramos su afiliación"                  |

Para empezar de cero otra vez, repita `npm run db:ejemplo`.

La cámara funciona en `http://localhost:8788` y en la página publicada (https). Si abre la prueba
desde otro aparato con la IP de su computadora (`http://192.168...`), el navegador no permite usar
la cámara: use "Elegir de mis fotos".

## 4. Publicarlo en Cloudflare Pages (una sola vez)

1. Cree una cuenta en https://dash.cloudflare.com (idealmente a nombre de ADEP, no personal).
2. Inicie sesión desde la terminal:
   ```
   npx wrangler login
   ```
3. Publique la página por primera vez (le pregunta el nombre del proyecto: deje `carnet-adep`):
   ```
   npm run publicar
   ```
4. Guarde la conexión al Supabase **real** como secretos de Cloudflare (le pide pegar cada valor):
   ```
   npx wrangler pages secret put SUPABASE_URL
   npx wrangler pages secret put SUPABASE_SECRET_KEY
   ```
5. Publique de nuevo para que tome los secretos:
   ```
   npm run publicar
   ```
   Al terminar le da la dirección, por ejemplo **https://carnet-adep.pages.dev**.

Para publicar cambios en el diseño o el código, solo repita `npm run publicar`.

## 5. Cargar o actualizar la lista de afiliados y filiales

**Un solo afiliado nuevo:** en Supabase, **Table Editor → `carnet_afiliados` → Insert row**, con la cédula
de 9 dígitos **sin guiones** (ej. `102340567`) y `activo` = `true`. Queda listo al instante.
Para desactivar a alguien, cambie `activo` a `false`.

**La lista completa desde el Excel:**

1. **Afiliados:** del Excel de ADEP solo se necesita la columna **cedula** (con o sin guiones).
   Si tiene una columna **activo** (`1`/`sí` = activo, `0`/`no` = inactivo), también se usa.
   Las demás columnas se ignoran. Guárdelo como **CSV** en `datos/afiliados.csv`.
   Vea el ejemplo en `datos/ejemplo-afiliados.csv`.
2. **Filiales:** cree `datos/filiales.txt` con una filial por línea.
   Vea el ejemplo en `datos/ejemplo-filiales.txt` (son de ejemplo: use las reales de ADEP).
3. Copie `.env.produccion.ejemplo` como **`.env.produccion`** y ponga la URL y la clave del proyecto **real**.
4. Ejecute:
   ```
   npm run importar     # revisa los archivos y avisa si hay errores (no sube nada)
   npm run db:subir     # los sube a la base REAL (pide escribir SUBIR para confirmar)
   ```
   Para subirlos a la base de prueba: `npm run db:subir-prueba`.

**Las listas que suba reemplazan a las anteriores**, en un solo paso (si algo falla, no cambia nada).
Los carnets que ya crearon los afiliados se conservan: si una cédula sale de la lista o queda inactiva,
su carnet deja de mostrarse, y si vuelve, reaparece.

> ⚠️ `datos/afiliados.csv`, `.dev.vars` y `.env.produccion` tienen datos de afiliados o claves.
> Están excluidos de Git (`.gitignore`) para que **nunca** se suban a GitHub. No los comparta.

## 6. Tareas comunes

**Un afiliado subió una foto inadecuada:** bórrela. La próxima vez que abra su carnet, la página le
pedirá tomarse una nueva. Si tiene su número, avísele por WhatsApp.
```
npm run borrar-foto -- 1-0234-0567
```

**Un afiliado dice que otra persona creó su carnet, o se equivocó en sus datos:** primero borre su foto
(comando anterior) y luego, en Supabase, **Table Editor → `carnet_carnets`**, borre la fila de su cédula.
Así puede crearlo de nuevo. Para corregir solo el nombre o la filial, edite la fila directamente.

**Ver cuántos carnets se han creado:** Table Editor → `carnet_carnets` (el total aparece abajo), o en
SQL Editor: `select count(*) from carnet_carnets;`

**Respaldos:** Supabase hace respaldos diarios automáticos en los planes pagados. Para un respaldo manual
de las tablas, use **Database → Backups**, o `pg_dump` con la cadena de conexión del proyecto.
Las fotos se descargan desde **Storage → carnet-fotos**.

## 7. Antes de publicar

- **Política de privacidad:** abra `public/privacidad.html` y complete lo marcado como pendiente (cédula
  jurídica, dirección, fecha y plazo de conservación). Es un borrador: conviene que lo revise la asesoría legal de ADEP.
- **Dirección definitiva de la página:** el QR lleva a la dirección donde está publicada la página
  (por ejemplo `https://carnet.adepcr.org/v/...`). Como se genera cada vez que se abre, si luego cambia de
  dominio los códigos nuevos usan la dirección nueva; aun así, conviene decidir el dominio antes de publicar.

## 8. Personalizar

- **Plantilla del carnet:** la actual es **provisional**. En `public/index.html` está entre las marcas
  `PLANTILLA PROVISIONAL` y `FIN DE LA PLANTILLA PROVISIONAL`; sus estilos están en `public/estilos.css`
  (clases `.carnet-v` y `.cv-…`). Los datos se llenan solos en los elementos con
  `data-campo="nombre|cedula|filial|emitido"` y la foto en los que tienen `data-foto`.
- **Texto de autorización de la foto:** en `public/index.html` (busque "Autorizo a ADEP"). Conviene que
  ADEP lo revise.
- **Logo:** está en `public/logo.png` (redondo, con fondo transparente). Para cambiarlo, reemplace ese archivo
  por otro con el mismo nombre. Los íconos de la app (`public/iconos/`) se hicieron a partir de él; si consigue
  el logo en mejor calidad (512 × 512 px o más), conviene volver a generarlos.
- **Cambios en la página y celulares con la app instalada:** la app busca la versión nueva cada vez que
  hay internet. Si cambia la lista de archivos de `public/sw.js`, suba también el número de `VERSION` en ese archivo.
- **Textos, teléfono y correo:** en `public/index.html`.
- **Número y mensaje de WhatsApp:** al inicio de `public/app.js`.
- **Colores:** al inicio de `public/estilos.css` (`--verde`, `--rojo`, etc.).
