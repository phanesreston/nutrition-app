import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { searchFoods } from "@/server/foods";

/** GET /api/foods/search?q=kale — also the endpoint a future mobile client would use. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const user = await getCurrentUser();
  const foods = await searchFoods(q, 25, user.id);
  return NextResponse.json({ foods });
}
