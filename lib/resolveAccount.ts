import { prisma } from '@/lib/prisma'

/**
 * Resolves an Account for the given Clerk userId, or falls back to the shared
 * guest account when the app is used without authentication.
 * Creates the account on first access if it doesn't exist yet.
 */
export async function resolveAccount(userId: string | null) {
  const key = userId ?? 'guest'

  let account = await prisma.account.findUnique({ where: { userId: key } })

  if (!account) {
    account = await prisma.account.create({
      data: {
        userId: key,
        email: userId ? userId : 'guest@local',
        name: userId ? 'User' : 'Guest',
      },
    })
  }

  return account
}
