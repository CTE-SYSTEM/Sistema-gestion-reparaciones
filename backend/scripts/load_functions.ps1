# Este script usa el mismo cargador SQL que la inicializacion con Docker.
$ErrorActionPreference = "Stop"
docker compose -f (Join-Path $PSScriptRoot '..\..\docker-compose.yml') exec -T backend npm run db:functions:container
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
