-- Lista oficial de ADEP: quién puede crear su carnet.
-- La cédula se guarda sin guiones (9 dígitos).
CREATE TABLE IF NOT EXISTS afiliados (
  cedula TEXT PRIMARY KEY,
  activo INTEGER NOT NULL DEFAULT 1  -- 1 = activo, 0 = inactivo
);

-- Filiales que el afiliado puede elegir al crear su carnet.
CREATE TABLE IF NOT EXISTS filiales (
  nombre TEXT PRIMARY KEY
);

-- Carnets creados por los mismos afiliados.
CREATE TABLE IF NOT EXISTS carnets (
  cedula     TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  filial     TEXT NOT NULL,
  nacimiento TEXT NOT NULL,          -- formato AAAA-MM-DD
  token      TEXT NOT NULL UNIQUE,   -- para "recordar en este celular" (secreto, nunca se muestra)
  verificacion TEXT UNIQUE,          -- código público del QR del carnet (/v/<código>)
  creado     TEXT NOT NULL,          -- fecha de creación AAAA-MM-DD
  foto       TEXT,                   -- fecha y hora en que subió su foto (NULL = sin foto)
  consentimiento TEXT                -- fecha y hora en que autorizó guardar su foto
);
-- La foto en sí se guarda en Cloudflare R2 (bucket "carnet-adep-fotos") como fotos/<cedula>.jpg

-- Intentos fallidos por IP, para frenar a quien pruebe muchas fechas o cédulas.
CREATE TABLE IF NOT EXISTS intentos (
  ip    TEXT NOT NULL,
  fecha INTEGER NOT NULL             -- milisegundos desde 1970
);
CREATE INDEX IF NOT EXISTS idx_intentos_ip_fecha ON intentos (ip, fecha);
