// server/routes/s/[code].get.ts
import prisma from "~/server/utils/prisma";
import {
  defineEventHandler,
  getRouterParam,
  getHeader,
  sendRedirect,
  createError,
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

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code");

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing code",
    });
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
    throw createError({
      statusCode: 404,
      statusMessage: "Short URL not found",
    });
  }

  const userAgent = firstHeaderValue(event, "user-agent") ?? null;
  const ipAddress = getClientIp(event);

  // Don't block redirect if analytics logging fails
  try {
    await prisma.analytics.create({
      data: {
        shortUrlId: shortUrl.id,
        qrCodeId: shortUrl.qrCode?.id ?? null,
        userAgent,
        ipAddress,
      },
    });
  } catch (err) {
    console.error("Redirect analytics logging failed:", err);
  }

  return sendRedirect(event, shortUrl.originalUrl, 302);
});