-- Tabla de fotos. Se crea igual en cada una de las 4 bases de fotos (carnet-adep-fotos-1 … -4).
-- Cada foto es un JPEG de 360 × 480 px (unos 30 KB), guardado como BLOB.
CREATE TABLE IF NOT EXISTS fotos (
  cedula TEXT PRIMARY KEY,           -- 9 dígitos, sin guiones
  imagen BLOB NOT NULL,
  subida TEXT NOT NULL               -- fecha y hora en que se subió (ISO)
);
