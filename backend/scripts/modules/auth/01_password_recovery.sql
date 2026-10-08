CREATE TABLE IF NOT EXISTS "RecuperacionPassword" (
  usuario_id integer PRIMARY KEY REFERENCES "Usuarios"(id_usuario) ON DELETE CASCADE,
  codigo_hash text NOT NULL,
  expira_en timestamptz(3) NOT NULL,
  solicitado_en timestamptz(3) NOT NULL DEFAULT now(),
  intentos integer NOT NULL DEFAULT 0
);
