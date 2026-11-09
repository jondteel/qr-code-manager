// server/api/analytics/overview.get.ts
import prisma from "~/server/utils/prisma";
import { requireEmailAccount } from "~/server/utils/require-email-account";
import { createError, getQuery } from "h3";
import { analyticsWindow, parseAnalyticsPeriod, averagePerDay, growth, chartWindow, dailySeries } from "~/server/utils/analytics-window.mjs";

export default defineEventHandler(async (event) => {
  try {
    // Auth
    const user = await requireEmailAccount(event);
    if (!user?.sub) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    // Query params
    const query = getQuery(event);
    let period: 7 | 30 | 90 | "all";
    try { period = parseAnalyticsPeriod(query.period); }
    catch { throw createError({ statusCode: 400, statusMessage: "Invalid analytics period" }); }
    const window = analyticsWindow(period, new Date());
    const timestamp = { ...(window.previous ? { gte: window.previous.start } : {}), lt: window.end };
    const chart = chartWindow(window);

    // Get user's QR codes + analytics within period
    const qrCodes = await prisma.qRCode.findMany({
      where: { userId: user.sub },
      select: {
        id: true,
        title: true,
        lifecycleStatus: true,
        data: true,
        analytics: {
          where: {
            timestamp,
          },
          select: {
            timestamp: true,
          },
        },
      },
    });

    // Coverage authority is not available; event timestamps do not establish it.
    const current = (t: Date) => (!window.start || t >= window.start) && t < window.end;
    const previous = (t: Date) => !!window.previous && t >= window.previous.start && t < window.previous.end;
    const currentQrs = qrCodes.map((qr) => ({ ...qr, analytics: qr.analytics.filter((scan) => current(new Date(scan.timestamp))) }));
    const currentScans = currentQrs.flatMap((qr) => qr.analytics);
    const totalScans = currentScans.length;
    const previousScans = window.previous ? qrCodes.reduce((sum, qr) => sum + qr.analytics.filter((scan) => previous(new Date(scan.timestamp))).length, 0) : null;
    const uniqueVisitors = null;
    const avgScansPerDay = averagePerDay(totalScans, null);
    const comparison = growth(totalScans, previousScans, false);
    const scanGrowth = comparison.value;
    const activeQRCodes = currentQrs.filter((qr) => qr.analytics.length > 0).length;
    const series = dailySeries(currentScans, chart);

    // Top performing QR codes by scan count in selected period
    const topQRCodes = currentQrs
      .map((qr) => ({
        id: qr.id,
        title: qr.title,
        lifecycleStatus: qr.lifecycleStatus,
        data: qr.data,
        scanCount: qr.analytics.length,
      }))
      .sort((a, b) => b.scanCount - a.scanCount)
      .slice(0, 10);

    return {
      success: true,
      stats: {
        totalScans,
        uniqueVisitors,
        activeQRCodes,
        avgScansPerDay,
        scanGrowth,
      },
      series,
      range: { ...window, chart, previousScans, growthStatus: comparison.status, coverage: "unknown" },
      topQRCodes,
    };
  } catch (error: any) {
    if (error?.statusCode) throw error;

    console.error({ event: 'analytics-overview', outcome: 'failed', reason: 'unexpected-error' });

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch analytics",
    });
  }
});