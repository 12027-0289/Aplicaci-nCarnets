# Mi Carnet ADEP

Página web donde los afiliados de ADEP crean y ven su carnet digital.

- **Crear mi carnet (primera vez):** el afiliado escribe su cédula, su nombre, elige su filial y su
  fecha de nacimiento (día, mes y año en tres listas). Solo se puede si la cédula está en la lista
  de afiliados activos de ADEP.
- **Ver mi carnet:** cédula + fecha de nacimiento.
- **Recordar en este celular:** después de entrar una vez, el carnet aparece directo al abrir la página.
- El carnet se puede ver vertical u horizontal, descargar como imagen o imprimir.
- Si la cédula no está en la lista, se le ofrece escribir por WhatsApp para afiliarse.

Funciona en **Cloudflare Pages + D1**: gratis, siempre encendido y no se apaga por inactividad.

## Cómo está hecho

```
public/                   → la página que ve el afiliado
  index.html
  estilos.css
  app.js
  logo.svg                → logo provisional: reemplácelo por el oficial
functions/api/            → lo que corre en el servidor
  crear.js                → crea el carnet (si la cédula está en la lista)
  ingresar.js             → muestra el carnet con cédula + fecha de nacimiento
  carnet.js               → "recordar en este celular"
  filiales.js             → lista de filiales
lib/comun.js              → funciones compartidas
schema.sql                → crea las tablas de la base de datos
scripts/importar.mjs      → prepara la lista de cédulas y filiales para subirla
datos/                    → ejemplos de cómo deben venir las listas
wrangler.toml             → configuración de Cloudflare
```

La base de datos tiene:

| Tabla       | Qué guarda                                           | Quién la llena             |
|-------------|------------------------------------------------------|----------------------------|
| `afiliados` | Cédulas de los afiliados y si están activos          | ADEP (con el Excel)        |
| `filiales`  | Lista de filiales                                    | ADEP                       |
| `carnets`   | Nombre, filial y fecha de nacimiento de cada carnet  | El afiliado, al crearlo    |
| `intentos`  | Intentos fallidos, para frenar a quien intente adivinar | Automático              |

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
| 1-0234-0567 | 14 marzo 1958       | Ya tiene carnet: "Ver mi carnet" lo muestra     |
| 2-0456-0789 | (la que usted elija) | Afiliado sin carnet: puede crearlo             |
| 4-0111-0222 | (la que usted elija) | Afiliado sin carnet: puede crearlo             |
| 3-0321-0654 | —                   | Inactiva: "No encontramos su afiliación"        |
| Cualquier otra | —                | "No encontramos su afiliación"                  |

Para empezar de cero otra vez, repita `npm run db:reiniciar-local`.

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
4. Cree las tablas en la base de datos de Cloudflare:
   ```
   npm run db:crear
   ```
5. Cargue la lista de afiliados y filiales (vea la sección 4).
6. Publique la página:
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

**Un afiliado dice que otra persona creó su carnet, o se equivocó en sus datos:** borre su carnet para
que lo cree de nuevo (cambie la cédula, sin guiones):
```
npx wrangler d1 execute carnet-adep --remote --command "DELETE FROM carnets WHERE cedula = '102340567'"
```

**Ver cuántos carnets se han creado:**
```
npx wrangler d1 execute carnet-adep --remote --command "SELECT COUNT(*) AS carnets FROM carnets"
```

## 6. Personalizar

- **Logo:** reemplace `public/logo.svg` por el logo oficial (si es PNG, cambie `logo.svg` por `logo.png` en `index.html`).
- **Textos, teléfono y correo:** en `public/index.html`.
- **Número y mensaje de WhatsApp:** al inicio de `public/app.js`.
- **Colores:** al inicio de `public/estilos.css` (`--verde`, `--rojo`, etc.).
