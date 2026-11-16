import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { lookupBarcode } from "@/server/barcode";

const HTTP_STATUS = { found: 200, invalid: 400, "not-found": 404, error: 503 } as const;

/**
 * GET /api/barcode/3017620422003[?format=upc_e]
 * Looks a product up locally, then in Open Food Facts. The body is always a
 * `BarcodeLookup`; the HTTP status mirrors its `status`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? undefined;
  const user = await getCurrentUser();
  const result = await lookupBarcode(user.id, code.slice(0, 32), format);
  return NextResponse.json(result, { status: HTTP_STATUS[result.status] });
}
