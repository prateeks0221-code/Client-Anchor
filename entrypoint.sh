#!/bin/sh
set -e

echo "Running Prisma migrations..."
# Use full path — works in Docker standalone AND native Node environments
./node_modules/.bin/prisma migrate deploy || \
  node_modules/.bin/prisma migrate deploy || \
  npx --yes prisma migrate deploy

echo "Starting server..."
exec node server.js
