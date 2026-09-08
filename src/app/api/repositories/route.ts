import { NextRequest, NextResponse } from "next/server";
import { getRepositories } from "@/server/db/scanning";
import { repositories as fixtureRepos } from "@/fixtures/repositories";

export async function GET() {
  try {
    const data = await getRepositories();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(fixtureRepos);
  }
}
