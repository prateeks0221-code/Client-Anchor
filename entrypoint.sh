#!/bin/sh

echo "Running Prisma migrations..."
echo "DATABASE_URL is set: $(if [ -n "$DATABASE_URL" ]; then echo 'yes'; else echo 'NO — this will fail'; fi)"

prisma migrate deploy 2>&1 || {
  echo "---"
  echo "Migration failed (exit $?). Continuing with server startup anyway..."
  echo "If this is a fresh deploy, ensure DATABASE_URL is set and the database is reachable."
  echo "---"
}

echo "Starting server..."
exec node server.js
