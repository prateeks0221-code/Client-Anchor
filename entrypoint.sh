#!/bin/sh
set -e

echo "Running Prisma migrations..."
prisma migrate deploy

echo "Starting server..."
exec node server.js
