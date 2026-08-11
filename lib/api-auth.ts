import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Shared-secret guard for routes the Sandberg CRM pulls from (see
// CONTEXT.md's "two-way data exchange with the CRM" section). The CRM sends
// `Authorization: Bearer <FUNNEL_API_TOKEN>`; compared in constant time so a
// timing side-channel can't leak the token a byte at a time.
//
// Fails CLOSED: if FUNNEL_API_TOKEN isn't configured in this environment, every
// guarded route returns 503 rather than silently falling open to
// unauthenticated access — a missing env var must never be indistinguishable
// from "no auth required".
//
// Deliberately NOT applied to /api/public-view/[slug]/* — those routes serve
// the public client-facing share links and carry no personal data by design;
// see their own route-level comments.
export function requireCrmToken(request: NextRequest): NextResponse | null {
  const configured = process.env.FUNNEL_API_TOKEN;
  if (!configured) {
    return NextResponse.json({ error: "FUNNEL_API_TOKEN not configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token || !constantTimeEqual(token, configured)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  // timingSafeEqual throws on length mismatch — hash both sides to a fixed-size
  // digest first, so a length difference in the raw token can't short-circuit
  // the comparison time either.
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}
