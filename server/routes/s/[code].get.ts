// server/routes/s/[code].get.ts
import prisma from "~/server/utils/prisma";
import { defineEventHandler, getRouterParam, getHeader, sendRedirect } from "h3";

function headerToString(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

import type { H3Event } from "h3";

function firstHeaderValue(event: H3Event, name: string): string | undefined {
  const raw: unknown = getHeader(event, name) as unknown;

  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];

  return undefined;
}

function getClientIp(event: H3Event) {
  const xff = firstHeaderValue(event, "x-forwarded-for");
  if (xff) {
  const first = xff.split(",").map(s => s.trim()).find(Boolean);
  if (first) return first;
}

  const realIp = firstHeaderValue(event, "x-real-ip");
  if (realIp) return realIp.trim();

  return event.node?.req?.socket?.remoteAddress || "unknown";
}

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code");

  if (!code) {
    return { error: "Missing code", statusCode: 400 };
  }

  const shortUrl = await prisma.shortUrl.findUnique({
    where: { shortCode: code },
    select: {
      id: true,
      originalUrl: true,
      qrCode: { select: { id: true } },
    },
  });

  if (!shortUrl) {
    return { error: "Short URL not found", statusCode: 404 };
  }

  const uaRaw = getHeader(event, "user-agent");
  const userAgent = headerToString(uaRaw) ?? null;

  const ipAddress = getClientIp(event) || "unknown";

  await prisma.analytics.create({
    data: {
      shortUrlId: shortUrl.id,
      qrCodeId: shortUrl.qrCode?.id ?? null,
      userAgent,
      ipAddress,
    },
  });

  return sendRedirect(event, shortUrl.originalUrl, 302);
});