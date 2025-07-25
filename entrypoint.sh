#!/bin/sh

DB_PATH="/app/src/prisma/db/db.sqlite"  # Caminho dentro do container

if [ ! -f "$DB_PATH" ]; then
  echo "📦 Banco de dados não encontrado. Rodando seed inicial..."
  pnpm run seed
else
  echo "✅ Banco de dados já existe."
fi

echo "🚀 Iniciando aplicação..."
exec pnpm start
