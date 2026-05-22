import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { runAllSearchers } from '@/lib/searchers'
import { SearchFilters } from '@/types'

export async function POST(req: NextRequest) {
  // Auth is optional — anonymous users can still search
  const { userId } = await auth()

  try {
    const body = await req.json()
    const { prompt, filters }: { prompt: string; filters: SearchFilters } = body

    // Resolve or create account (auth optional — anonymous search allowed)
    let account = null

    if (userId) {
      account = await prisma.account.findUnique({ where: { userId } })
      if (!account) {
        try {
          const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
            headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
          })
          const clerkUser = await clerkRes.json()
          account = await prisma.account.create({
            data: {
              userId,
              email: clerkUser.email_addresses?.[0]?.email_address || 'unknown',
              name: `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim(),
            },
          })
        } catch (e) {
          console.error('Clerk fetch failed:', e)
          account = await prisma.account.create({
            data: { userId, email: 'unknown', name: 'User' },
          })
        }
      }
    } else {
      // Anonymous: create a transient guest account
      account = await prisma.account.findUnique({ where: { userId: 'guest' } })
      if (!account) {
        account = await prisma.account.create({
          data: { userId: 'guest', email: 'guest@clientanchor.local', name: 'Guest' },
        })
      }
    }

    // Create search query
    const search = await prisma.searchQuery.create({
      data: {
        userId: account.id,
        prompt,
        filters: filters || {},
        status: 'running',
      }
    })

    try {
      // Run searchers
      const rawResults = await runAllSearchers(prompt, filters || {})

      // Save results — merge top-level linkedinUrl into rawData for storage
      await prisma.result.createMany({
        data: rawResults.map(r => ({
          searchId: search.id,
          name: r.name,
          type: r.type,
          description: r.description?.slice(0, 500),
          website: r.website,
          email: r.email,
          phone: r.phone,
          address: r.address,
          city: r.city,
          country: r.country,
          source: r.source,
          sourceUrl: r.sourceUrl,
          rawData: {
            ...(r.rawData || {}),
            // Preserve LinkedIn URL from searchers that populate it at top level
            ...(r.linkedinUrl ? { linkedinUrl: r.linkedinUrl } : {}),
          },
          matchScore: 0,
        }))
      })

      const resultCount = rawResults.length
      await prisma.searchQuery.update({
        where: { id: search.id },
        data: { status: 'completed', resultCount }
      })

      return NextResponse.json({ 
        id: search.id, 
        resultCount, 
        status: 'completed' 
      })
    } catch (error) {
      await prisma.searchQuery.update({
        where: { id: search.id },
        data: { status: 'failed' }
      })
      console.error('Search execution failed:', error)
      return NextResponse.json(
        { error: 'Search failed', details: (error as Error).message },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Request parse failed:', error)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
