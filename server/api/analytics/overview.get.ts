// server/api/analytics/overview.get.ts
import prisma from "~/server/utils/prisma";
import { serverSupabaseUser } from "#supabase/server";
import { createError, getQuery } from "h3";

type PeriodValue = 7 | 30 | 90 | "all";

function parsePeriod(raw: unknown): PeriodValue {
  if (raw === "all") return "all";

  const n = Number(raw ?? 30);
  if (n === 7 || n === 30 || n === 90) return n;

  return 30;
}

export default defineEventHandler(async (event) => {
  try {
    // Auth
    const user = await serverSupabaseUser(event);
    if (!user?.sub) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    // Query params
    const query = getQuery(event);
    const period = parsePeriod(query.period);

    // Date range
    let startDate: Date;
    if (period === "all") {
      startDate = new Date(0);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
    }

    // Get user's QR codes + analytics within period
    const qrCodes = await prisma.qRCode.findMany({
      where: { userId: user.sub },
      select: {
        id: true,
        title: true,
        data: true,
        analytics: {
          where: {
            timestamp: { gte: startDate },
          },
          select: {
            timestamp: true,
            ipAddress: true,
          },
        },
      },
    });

    // Total scans
    const totalScans = qrCodes.reduce((sum, qr) => sum + qr.analytics.length, 0);

    // Unique visitors (estimated via IP)
    const uniqueIPs = new Set<string>();
    for (const qr of qrCodes) {
      for (const scan of qr.analytics) {
        if (scan.ipAddress && scan.ipAddress !== "unknown") {
          uniqueIPs.add(scan.ipAddress);
        }
      }
    }
    const uniqueVisitors = uniqueIPs.size;

    // Active QR codes (scanned this period)
    const activeQRCodes = qrCodes.filter((qr) => qr.analytics.length > 0).length;

    // Average scans/day
    const days =
      period === "all"
        ? Math.max(
            1,
            Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          )
        : period;

    const avgScansPerDay = Math.round(totalScans / days);

    // Placeholder growth (keep until you implement prev-period comparison)
    const scanGrowth = 0;

    // Scans over time (bucketed by UTC date)
    const buckets = new Map<string, number>(); // YYYY-MM-DD -> count

    for (const qr of qrCodes) {
      for (const scan of qr.analytics) {
        const key = new Date(scan.timestamp).toISOString().slice(0, 10);
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }

    let series: Array<{ date: string; scans: number }> = [];

    if (period === "all") {
      // Sort and cap to last 365 points for payload safety
      const keys = Array.from(buckets.keys()).sort();
      const capped = keys.slice(Math.max(0, keys.length - 365));
      series = capped.map((k) => ({ date: k, scans: buckets.get(k) ?? 0 }));
    } else {
      // Fill missing days so chart remains continuous
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (period - 1));

      for (
        let cursor = new Date(start);
        cursor <= end;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const key = cursor.toISOString().slice(0, 10);
        series.push({ date: key, scans: buckets.get(key) ?? 0 });
      }
    }

    // Top performing QR codes by scan count in selected period
    const topQRCodes = qrCodes
      .map((qr) => ({
        id: qr.id,
        title: qr.title,
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
      topQRCodes,
    };
  } catch (error: any) {
    if (error?.statusCode) throw error;

    console.error("Analytics overview error:", error);

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch analytics",
    });
  }
});