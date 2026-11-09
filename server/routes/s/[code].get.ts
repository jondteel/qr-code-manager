// server/routes/s/[code].get.ts
import prisma from "~/server/utils/prisma";
import { recordRedirectScan } from "~/server/utils/qr-scan.mjs";
import { decodeRedirectCode, resolveRedirect } from "~/server/utils/qr-redirect.mjs";
import {
  defineEventHandler,
  getRouterParam,
  getHeader,
  sendRedirect,
  setResponseStatus,
  type H3Event,
} from "h3";

function firstHeaderValue(event: H3Event, name: string): string | undefined {
  const raw = getHeader(event, name) as unknown;

  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];

  return undefined;
}

function getClientIp(event: H3Event): string {
  const xff = firstHeaderValue(event, "x-forwarded-for");
  if (xff) {
    const first = xff.split(",").map((s) => s.trim()).find(Boolean);
    if (first) return first;
  }

  const realIp = firstHeaderValue(event, "x-real-ip");
  if (realIp) return realIp.trim();

  return event.node?.req?.socket?.remoteAddress ?? "unknown";
}

// Return generic failures directly: Nitro's default 404 renderer overwrites
// Cache-Control with no-cache. Normal H3 serialization preserves no-store.
function unavailable(event: H3Event, statusCode: 404 | 503) {
  setResponseStatus(event, statusCode, "Link unavailable");
  return { statusCode, statusMessage: "Link unavailable" };
}

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, "code");
  const code = decodeRedirectCode(raw);
  if (!code) return unavailable(event, 404);

  let decision;
  try {
    decision = await resolveRedirect(prisma, code);
  } catch {
    return unavailable(event, 503);
  }
  if (!decision.available) return unavailable(event, 404);

  const userAgent = firstHeaderValue(event, "user-agent") ?? null;
  const ipAddress = getClientIp(event);

  const scan = await recordRedirectScan(prisma, {
    shortUrlId: decision.shortUrlId,
    qrCodeId: decision.qrCodeId,
    userAgent,
    ipAddress,
  });

  if (scan.reason === "lifecycle-unavailable") return unavailable(event, 404);
  return sendRedirect(event, decision.destination, 302);
});
