# Mi Carnet ADEP — Guía de entrega para TI

Esta guía es para la persona de TI que queda a cargo del carnet digital. El `README.md` tiene el detalle de cada comando; aquí está lo necesario para **recibir el proyecto y mantenerlo**.

---

## 1. Qué es y dónde vive

| Pieza | Dónde está | Costo |
|---|---|---|
| **Código** | GitHub, organización `adepcr` | Gratis |
| **Página web** | Cloudflare Pages (`carnet-adep`) | Gratis |
| **Datos** (afiliados, filiales, carnets) | Cloudflare D1, base `carnet-adep` | Gratis, sin tarjeta |
| **Fotos** | Cloudflare D1, bases `carnet-adep-fotos-1` … `-4` | Gratis, sin tarjeta |

```
Celular del afiliado ──► Cloudflare Pages (página + funciones /api y /v)
                              ├─ D1 "carnet-adep"           → afiliados, filiales, carnets, intentos
                              └─ D1 "carnet-adep-fotos-1…4" → fotos (unos 30 KB cada una)
```

- **No hay contraseñas ni claves en el código.** Las páginas se conectan a las bases de datos por medio de Cloudflare (los *bindings* de `wrangler.toml`), así que no hay secretos que entregar ni que rotar.
- **Las fotos se reparten en 4 bases** porque en el plan gratis cada base admite 500 MB. A cada cédula le toca siempre la misma base: `cédula % 4 + 1`.

---

## 2. Cómo se entrega (cuentas)

La idea es que **todo quede a nombre de ADEP** desde el inicio, no en cuentas personales.

### GitHub
1. El repositorio se transfiere a la organización **`adepcr`** (*Settings → Danger Zone → Transfer ownership*).
2. TI queda como administrador del repositorio. Quien desarrolló el proyecto puede quedar como colaborador o salir.

### Cloudflare
1. **TI crea la cuenta** de Cloudflare con un correo institucional (por ejemplo `ti@adepcr.org`), no personal.
2. TI invita a quien va a configurar el proyecto: *Manage Account → Members → Invite*, con rol de **Administrator**.
3. Esa persona inicia sesión (`npx wrangler login`), corre `npm run configurar` y `npm run publicar` **en la cuenta de ADEP**.
4. Al terminar, TI le quita el acceso en *Members*. **No hay nada que transferir**: las bases de datos y la página ya están en la cuenta de ADEP.

> ⚠️ Cloudflare **no permite mover** bases D1 ni proyectos de Pages de una cuenta a otra. Si algo se creó en una cuenta personal, hay que sacar un respaldo (`npm run respaldo`), crear todo de nuevo en la cuenta de ADEP (`npm run configurar`) y restaurar el respaldo (sección 5).

### Lista de entrega

- [ ] Repositorio en `github.com/adepcr`, con TI como administrador
- [ ] Cuenta de Cloudflare con correo institucional, controlada por TI
- [ ] `npm run configurar` ejecutado y los IDs de `wrangler.toml` guardados en GitHub
- [ ] Lista real de afiliados y filiales cargada (`npm run db:subir`)
- [ ] Página publicada (`npm run publicar`) y probada desde un celular
- [ ] Política de privacidad completa (`public/privacidad.html`, lo marcado en amarillo)
- [ ] Primer respaldo hecho (`npm run respaldo`) y guardado en un lugar seguro
- [ ] Acceso de la persona desarrolladora retirado de Cloudflare (y de GitHub, si corresponde)

---

## 3. Base de datos

### `carnet-adep` (definida en `schema.sql`)

| Tabla | Campos | Quién la llena |
|---|---|---|
| `afiliados` | `cedula` (9 dígitos, sin guiones), `activo` (1/0) | ADEP |
| `filiales` | `nombre` | ADEP |
| `carnets` | `cedula`, `nombre`, `filial`, `nacimiento` (AAAA-MM-DD), `token`, `verificacion`, `creado`, `foto`, `consentimiento` | El afiliado |
| `intentos` | `ip`, `fecha` — intentos fallidos; se borran solos a los 15 min | Automático |

- `token`: **secreto**. Es lo que permite abrir un carnet en un celular ("Recordar en este celular"). No compartirlo.
- `verificacion`: código **público** del QR. Al escanearlo se abre `/v/<código>`, que muestra si el carnet está vigente.
- `foto` / `consentimiento`: fecha y hora en que subió la foto y aceptó la autorización (Ley 8968). `foto` en `NULL` = sin foto: la página le exige una al entrar.

### `carnet-adep-fotos-1` … `-4` (definidas en `schema-fotos.sql`)

| Tabla | Campos |
|---|---|
| `fotos` | `cedula`, `imagen` (JPEG como BLOB, 360 × 480 px), `subida` |

### Consultar o editar a mano

En https://dash.cloudflare.com → **Storage & Databases → D1 → (base) → Console**, o desde la terminal:

```
npx wrangler d1 execute carnet-adep --remote --command "SELECT COUNT(*) FROM carnets"
```

---

## 4. Tareas de todos los días

### Agregar UN afiliado nuevo

En la consola de `carnet-adep` (o con `wrangler d1 execute ... --command`), con la cédula sin guiones:

```sql
INSERT INTO afiliados (cedula, activo) VALUES ('102340567', 1)
ON CONFLICT (cedula) DO UPDATE SET activo = 1;
```

Para desactivar a alguien: `UPDATE afiliados SET activo = 0 WHERE cedula = '102340567';`

> ⚠️ Cuando se sube el Excel completo (abajo), **la lista se reemplaza**. Si agregó a alguien a mano, asegúrese de que también esté en el Excel, o desaparecerá en la siguiente carga.

### Cargar la lista completa desde el Excel

1. Guarde el Excel como CSV en `datos/afiliados.csv` (columna `cedula`; opcional `activo`).
2. Las filiales en `datos/filiales.txt`, una por línea.
3. `npm run importar` (revisa y avisa errores) y luego `npm run db:subir`.

Los carnets ya creados se conservan. `datos/afiliados.csv` nunca se sube a GitHub.

### Otras tareas

| Tarea | Comando |
|---|---|
| Borrar una foto inadecuada (se le pide otra al entrar) | `npm run borrar-foto -- 1-0234-0567` |
| Borrar un carnet para que lo cree de nuevo | `npm run borrar-foto -- <cédula>` y luego `DELETE FROM carnets WHERE cedula = '...'` |
| Corregir nombre o filial | `UPDATE carnets SET nombre = '...' WHERE cedula = '...'` |
| Publicar cambios del código | `npm run publicar` |
| Respaldo | `npm run respaldo` |

---

## 5. Respaldos

- **Automático:** Cloudflare guarda el historial de cada base D1 (**Time Travel**) y permite volver a un momento anterior:
  ```
  npx wrangler d1 time-travel info carnet-adep
  npx wrangler d1 time-travel restore carnet-adep --timestamp=2026-11-05T12:00:00Z
  ```
- **Manual (recomendado una vez al mes):** `npm run respaldo` descarga las 5 bases a `respaldos/<fecha>/`.
  Esos archivos tienen **datos personales**: guárdelos cifrados o en una carpeta con acceso restringido.
- **Restaurar un respaldo manual** en una base vacía:
  ```
  npx wrangler d1 execute carnet-adep --remote --file=respaldos/<fecha>/carnet-adep.sql
  npx wrangler d1 execute carnet-adep-fotos-1 --remote --file=respaldos/<fecha>/carnet-adep-fotos-1.sql
  (… igual para fotos-2, -3 y -4)
  ```

---

## 6. Límites del plan gratis de Cloudflare

| Límite | Valor | ¿Preocupa? |
|---|---|---|
| Tamaño de cada base D1 | 500 MB | Fotos: ~60 000 en total. Revise con `npx wrangler d1 info carnet-adep-fotos-1` |
| Bases D1 por cuenta | 10 | Se usan 5 |
| Peticiones a las funciones (`/api`, `/v`) | 100 000 por día | No: cada afiliado usa unas pocas al abrir su carnet |
| Lecturas / escrituras D1 | 5 millones / 100 000 por día | No |

Si algún día las fotos se acercan a 500 MB por base, se puede pasar al plan pagado de Workers (5 USD/mes, 10 GB por base) sin cambiar el código.

---

## 7. Seguridad y protección de datos (Ley 8968)

- El sistema guarda **cédula, nombre, filial, fecha de nacimiento y foto** de cada afiliado que crea su carnet.
- Solo deben tener acceso a la cuenta de Cloudflare las personas que administran el sistema. Revise *Members* periódicamente.
- Active la **verificación en dos pasos** en Cloudflare y en GitHub.
- Nunca suba a GitHub: `datos/afiliados.csv`, la carpeta `respaldos/` ni capturas con datos de afiliados (el `.gitignore` ya los excluye).
- Las solicitudes de acceso, corrección o borrado de datos (política de privacidad, punto 8) se atienden con las tareas de la sección 4.
- La política de privacidad está en `public/privacidad.html`. Si cambia lo que se guarda o quién lo ve, hay que actualizarla.

---

## 8. Si algo falla

| Síntoma | Qué revisar |
|---|---|
| Nadie puede crear su carnet: "No encontramos su afiliación" | ¿Se cargó la lista? `SELECT COUNT(*) FROM afiliados WHERE activo = 1` |
| Error al guardar la foto | ¿Alguna base de fotos llegó a 500 MB? `npx wrangler d1 info carnet-adep-fotos-N` |
| La página no carga | Panel de Cloudflare → Workers & Pages → `carnet-adep` → *Deployments* (vuelva a la versión anterior con *Rollback*) |
| "Demasiados intentos" | Normal tras 10 intentos fallidos desde la misma conexión; se libera en 15 minutos |
| Un celular sigue mostrando una versión vieja | Cerrar la app o el navegador y abrir de nuevo (se actualiza al haber internet) |
