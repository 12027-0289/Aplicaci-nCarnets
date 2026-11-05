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
- El carnet se puede ver vertical u horizontal, descargar como imagen o imprimir.
- Si la cédula no está en la lista, se le ofrece escribir por WhatsApp para afiliarse.

Funciona en **Cloudflare Pages + D1 + R2**: gratis, siempre encendido y no se apaga por inactividad.
Las fotos se guardan en **Cloudflare R2** (gratis hasta 10 GB, más de 100 000 fotos).

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
schema.sql                → crea las tablas de la base de datos
scripts/importar.mjs      → prepara la lista de cédulas y filiales para subirla
scripts/borrar-foto.mjs   → borra la foto de un afiliado (fotos inadecuadas)
datos/                    → ejemplos de cómo deben venir las listas
wrangler.toml             → configuración de Cloudflare
```

La base de datos tiene:

| Tabla       | Qué guarda                                           | Quién la llena             |
|-------------|------------------------------------------------------|----------------------------|
| `afiliados` | Cédulas de los afiliados y si están activos          | ADEP (con el Excel)        |
| `filiales`  | Lista de filiales                                    | ADEP                       |
| `carnets`   | Nombre, filial, fecha de nacimiento y fecha de la foto/autorización | El afiliado, al crearlo |
| `intentos`  | Intentos fallidos, para frenar a quien intente adivinar | Automático              |

Cada carnet tiene un **código de verificación** público (12 letras y números al azar) que va en el QR
del botón "Mostrar código QR".
Es distinto de la clave secreta que usa "Recordar en este celular", así que escanear el QR no permite
entrar al carnet de nadie.

Las fotos están en R2 como `fotos/<cédula>.jpg` (480 × 640 px, unos 50–100 KB cada una). El celular
recorta y comprime la foto antes de enviarla, así sube rápido aunque la señal sea mala.

Tras 10 intentos fallidos en 15 minutos desde la misma conexión, se bloquean los intentos por un rato.

---

## 1. Lo que necesita instalar (una sola vez)

1. **Node.js** (versión LTS): https://nodejs.org
2. En una terminal, dentro de la carpeta del proyecto:
   ```
   npm install
   ```

## 2. Probarlo en su computadora

```
npm run db:reiniciar-local   # crea la base de datos de prueba (borra la anterior)
npm run dev                  # abre la página en http://localhost:8788
```

Datos de prueba:

| Cédula      | Fecha de nacimiento | Qué pasa                                        |
|-------------|---------------------|-------------------------------------------------|
| 1-0234-0567 | 14 marzo 1958       | Ya tiene carnet, sin foto: debe agregarla para verlo |
| 2-0456-0789 | (la que usted elija) | Afiliado sin carnet: puede crearlo             |
| 4-0111-0222 | (la que usted elija) | Afiliado sin carnet: puede crearlo             |
| 3-0321-0654 | —                   | Inactiva: "No encontramos su afiliación"        |
| Cualquier otra | —                | "No encontramos su afiliación"                  |

Para empezar de cero otra vez, repita `npm run db:reiniciar-local`.

La cámara funciona en `http://localhost:8788` y en la página publicada (https). Si abre la prueba
desde otro aparato con la IP de su computadora (`http://192.168...`), el navegador no permite usar
la cámara: use "Elegir de mis fotos".

## 3. Publicarlo en Cloudflare (una sola vez)

1. Cree una cuenta en https://dash.cloudflare.com (idealmente a nombre de ADEP, no personal).
2. Inicie sesión desde la terminal:
   ```
   npx wrangler login
   ```
3. Cree la base de datos:
   ```
   npx wrangler d1 create carnet-adep
   ```
   Copie el `database_id` que aparece y péguelo en `wrangler.toml`, en lugar de los ceros.
4. Cree el espacio para las fotos (R2). La primera vez, Cloudflare le pide activar R2 en
   https://dash.cloudflare.com → **R2** y registrar una tarjeta; no cobra nada mientras no pase de 10 GB.
   ```
   npx wrangler r2 bucket create carnet-adep-fotos
   ```
5. Cree las tablas en la base de datos de Cloudflare:
   ```
   npm run db:crear
   ```
6. Cargue la lista de afiliados y filiales (vea la sección 4).
7. Publique la página:
   ```
   npm run publicar
   ```
   La primera vez le pregunta el nombre del proyecto: deje `carnet-adep`.
   Al terminar le da la dirección, por ejemplo **https://carnet-adep.pages.dev**.

Para publicar cambios en el diseño o el código, solo repita `npm run publicar`.

## 4. Cargar o actualizar la lista de afiliados y filiales

1. **Afiliados:** del Excel de ADEP solo se necesita la columna **cedula** (con o sin guiones).
   Si tiene una columna **activo** (`1`/`sí` = activo, `0`/`no` = inactivo), también se usa.
   Las demás columnas se ignoran. Guárdelo como **CSV** en `datos/afiliados.csv`.
   Vea el ejemplo en `datos/ejemplo-afiliados.csv`.
2. **Filiales:** cree `datos/filiales.txt` con una filial por línea.
   Vea el ejemplo en `datos/ejemplo-filiales.txt` (son de ejemplo: use las reales de ADEP).
3. Ejecute:
   ```
   npm run importar     # revisa los archivos y avisa si hay errores
   npm run db:subir     # los sube a Cloudflare
   ```

**Las listas que suba reemplazan a las anteriores.** Los carnets que ya crearon los afiliados se conservan:
si una cédula sale de la lista o queda inactiva, su carnet deja de mostrarse, y si vuelve, reaparece.

> ⚠️ `datos/afiliados.csv` y `datos/importar.sql` tienen datos de afiliados. Están excluidos de Git
> (`.gitignore`) para que **nunca** se suban a GitHub. No los comparta.

## 5. Tareas comunes

**Un afiliado subió una foto inadecuada:** bórrela. La próxima vez que abra su carnet, la página le
pedirá tomarse una nueva. Si tiene su número, avísele por WhatsApp.
```
npm run borrar-foto -- 1-0234-0567
```

**Un afiliado dice que otra persona creó su carnet, o se equivocó en sus datos:** borre su carnet para
que lo cree de nuevo (cambie la cédula, sin guiones). El segundo comando borra también su foto:
```
npx wrangler d1 execute carnet-adep --remote --command "DELETE FROM carnets WHERE cedula = '102340567'"
npx wrangler r2 object delete carnet-adep-fotos/fotos/102340567.jpg --remote
```

**Ver cuántos carnets se han creado:**
```
npx wrangler d1 execute carnet-adep --remote --command "SELECT COUNT(*) AS carnets FROM carnets"
```

## 6. Antes de publicar

- **Política de privacidad:** abra `public/privacidad.html` y complete lo marcado como pendiente (cédula
  jurídica, dirección, fecha y plazo de conservación). Es un borrador: conviene que lo revise la asesoría legal de ADEP.
- **Dirección definitiva de la página:** el QR lleva a la dirección donde está publicada la página
  (por ejemplo `https://carnet.adepcr.org/v/...`). Como se genera cada vez que se abre, si luego cambia de
  dominio los códigos nuevos usan la dirección nueva; aun así, conviene decidir el dominio antes de publicar.

## 7. Personalizar

- **Plantilla del carnet:** la actual es **provisional**. En `public/index.html` está entre las marcas
  `PLANTILLA PROVISIONAL` y `FIN DE LA PLANTILLA PROVISIONAL`; sus estilos están en `public/estilos.css`
  (`.carnet…` horizontal y `.cv-…` vertical). Los datos se llenan solos en los elementos con
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
