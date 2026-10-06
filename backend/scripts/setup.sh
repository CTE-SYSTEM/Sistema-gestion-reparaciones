#!/bin/sh
set -eu

echo "--- Sincronizando Esquema ---"
npx prisma generate
npx prisma db push

echo ">>> Cargando funciones y procedimientos..."
npm run db:functions:container

# Verificar si hay usuarios para determinar si es "primera vez"
COUNT=$(psql "$SQL_DATABASE_URL" -tAc "SELECT count(*) FROM \"Usuarios\";" 2>/dev/null || echo 0)
COUNT=$(echo "$COUNT" | tr -d '[:space:]')

if [ "${COUNT:-0}" -eq 0 ]; then
  echo ">>> [PRIMERA VEZ] Ejecutando semilla..."
  npm run db:seed
else
  echo ">>> [ARRANQUE NORMAL] Base de datos detectada. Saltando semilla."
fi
