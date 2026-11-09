// server/api/analytics/qr/[id].get.ts
import prisma from "~/server/utils/prisma";
import { requireEmailAccount } from "~/server/utils/require-email-account";
import { createError, getQuery, getRouterParam } from "h3";
import { analyticsWindow, parseAnalyticsPeriod, averagePerDay, growth, chartWindow, dailySeries } from "~/server/utils/analytics-window.mjs";
import { presentQr, readQrSnapshot, serverQrStage } from '~/server/utils/qr-issuance.mjs'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireEmailAccount(event);
    if (!user?.sub) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    const id = getRouterParam(event, "id");
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing QR id",
      });
    }

    const query = getQuery(event);
    let period: 7 | 30 | 90 | "all";
    try { period = parseAnalyticsPeriod(query.period); }
    catch { throw createError({ statusCode: 400, statusMessage: "Invalid analytics period" }); }
    const window = analyticsWindow(period, new Date());
    const timestamp = { ...(window.previous ? { gte: window.previous.start } : {}), lt: window.end };
    const chart = chartWindow(window);

    // Ensure the QR belongs to this user
    const qr = await readQrSnapshot(prisma, (tx) => tx.qRCode.findFirst({
      where: { id, userId: user.sub },
      select: {
        userId: true,
        issuedEncodedTarget: true,
        lifecycleStatus: true,
        errorLevel: true,
        shortUrlId: true,
        id: true,
        title: true,
        data: true,
        createdAt: true,
        shortUrl: {
          select: {
            id: true,
            originalUrl: true,
            userId: true,
            shortCode: true,
          },
        },
      },
    }));

    if (!qr) {
      throw createError({
        statusCode: 404,
        statusMessage: "QR code not found",
      });
    }

    const presented = presentQr(qr, user.sub, useRuntimeConfig(event), process.env.VERCEL_ENV, serverQrStage(process.env));

    // Pull scans for this QR (within period)
    const scans = await prisma.analytics.findMany({
      where: {
        qrCodeId: qr.id,
        timestamp,
      },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        timestamp: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    const currentScans = scans.filter((scan) => (!window.start || new Date(scan.timestamp) >= window.start) && new Date(scan.timestamp) < window.end);
    const previousScans = window.previous ? scans.filter((scan) => new Date(scan.timestamp) >= window.previous!.start && new Date(scan.timestamp) < window.previous!.end).length : null;
    const totalScans = currentScans.length;
    const uniqueVisitors = null;
    const avgScansPerDay = averagePerDay(totalScans, null);
    const comparison = growth(totalScans, previousScans, false);
    const series = dailySeries(currentScans, chart);

    // Latest scans table (cap payload)
    const recentScans = currentScans.slice(0, 50);

    return {
      success: true,
      qr: {
        lifecycleStatus: presented.lifecycleStatus,
        mode: presented.mode,
        encodedTarget: presented.encodedTarget,
        payloadStatus: presented.payloadStatus,
        payloadProvenance: presented.payloadProvenance,
        payloadState: presented.payloadState,
        id: qr.id,
        title: qr.title,
        data: qr.data,
        createdAt: qr.createdAt,
        shortUrl: presented.shortUrl ? { shortCode: presented.shortUrl.shortCode } : null,
      },
      stats: {
        totalScans,
        uniqueVisitors,
        avgScansPerDay,
      },
      series,
      range: { ...window, chart, previousScans, growthStatus: comparison.status, coverage: "unknown" },
      recentScans,
    };
  } catch (error: any) {
    // Preserve H3/Nuxt errors with status codes
    if (error?.statusCode) throw error;

    console.error({ event: 'qr-analytics', outcome: 'failed', reason: 'unexpected-error' });

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch QR analytics",
    });
  }
});
