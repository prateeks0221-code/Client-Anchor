import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DashboardResult, DashboardData } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const searchQuery = await prisma.searchQuery.findUnique({
      where: { id },
      include: {
        results: {
          include: { contacts: true },
          orderBy: { matchScore: "desc" },
        },
      },
    });

    if (!searchQuery) {
      return NextResponse.json(
        { error: "Search not found" },
        { status: 404 }
      );
    }

    const formattedResults: DashboardResult[] = searchQuery.results.map((r) => ({
      id: r.id,
      title: r.name,
      description: r.description || "",
      url: r.sourceUrl || r.website || "",
      source: r.source,
      score: r.matchScore || 0,
      matchReason: r.matchReason,
      enrichment: {
        ...(typeof r.rawData === "object" && r.rawData ? (r.rawData as Record<string, unknown>) : {}),
        email: r.email,
        phone: r.phone,
        address: r.address,
        city: r.city,
        country: r.country,
        type: r.type,
      },
      contacts: r.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        email: c.email,
        linkedin: c.linkedin,
        isPrimary: c.isPrimary,
      })),
    }));

    const response: DashboardData = {
      id: searchQuery.id,
      prompt: searchQuery.prompt,
      intent: searchQuery.intent,
      resultCount: searchQuery.resultCount,
      avgScore: searchQuery.avgScore,
      createdAt: searchQuery.createdAt.toISOString(),
      results: formattedResults,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
