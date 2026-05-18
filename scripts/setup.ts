/**
 * ClientAnchor — Database Setup Script
 *
 * Run these commands IN ORDER after cloning and setting up .env.local:
 *
 * 1. Generate Prisma client from schema:
 *    npx prisma generate
 *
 * 2. Push schema to database (creates tables, no migration history):
 *    npx prisma db push
 *    NOTE: Use this for initial setup / rapid prototyping only.
 *    Switch to `npx prisma migrate dev` before production.
 *
 * 3. (Optional) Open Prisma Studio to inspect data:
 *    npx prisma studio
 *
 * Prerequisites:
 *  - DATABASE_URL set in .env.local pointing to a live PostgreSQL instance
 *  - All env vars in .env.local populated
 *
 * Recommended local DB for dev:
 *  - Docker: docker run --name clientanchor-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
 *  - Then: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clientanchor
 */

export {};
