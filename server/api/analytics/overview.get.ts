// server/api/analytics/overview.get.ts
import prisma from "~/server/utils/prisma";
import { serverSupabaseUser } from "#supabase/server";

export default defineEventHandler(async (event) => {
  try {
    // Check authentication
    const user = await serverSupabaseUser(event);
    if (!user || !user.sub) {
      return {
        error: "Unauthorized",
        statusCode: 401,
      };
    }

    // Get query params
    const query = getQuery(event);
    const periodRaw = query.period ?? 30;
    const period = periodRaw === "all" ? "all" : Number(periodRaw);

    // Calculate date range
    let startDate: Date;
    if (period === "all") {
      startDate = new Date(0);
    } else {
      // fallback safety
      const daysBack = Number.isFinite(period) && period > 0 ? period : 30;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
    }

    // Get user's QR codes + analytics within period
    const qrCodes = await prisma.qRCode.findMany({
      where: { userId: user.sub },
      include: {
        analytics: {
          where: {
            timestamp: { gte: startDate },
          },
          select: {
            timestamp: true,
            ipAddress: true,
          },
        },
        shortUrl: true,
      },
    });

    // Calculate stats
    const totalScans = qrCodes.reduce((sum, qr) => sum + qr.analytics.length, 0);

    // Unique visitors (count unique IP addresses)
    const uniqueIPs = new Set<string>();
    for (const qr of qrCodes) {
      for (const scan of qr.analytics) {
        if (scan.ipAddress && scan.ipAddress !== "unknown") {
          uniqueIPs.add(scan.ipAddress);
        }
      }
    }
    const uniqueVisitors = uniqueIPs.size;

    // Active QR codes (ones with at least 1 scan in period)
    const activeQRCodes = qrCodes.filter((qr) => qr.analytics.length > 0).length;

    // Average scans per day
    const days =
      period === "all"
        ? Math.max(
            1,
            Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          )
        : Math.max(1, Number(period));

    const avgScansPerDay = Math.round(totalScans / days);

    // Growth (still placeholder)
    const scanGrowth = 0;

    // ✅ Scans over time (bucketed by day)
    // We will return last N days if period != all; if all, we return up to last 365 points to avoid huge payloads.
    const buckets = new Map<string, number>(); // yyyy-mm-dd -> count

    for (const qr of qrCodes) {
      for (const scan of qr.analytics) {
        const d = new Date(scan.timestamp);
        // normalize to date (UTC date string keeps stable across server TZ)
        const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }

    let series: Array<{ date: string; scans: number }> = [];

    if (period === "all") {
      // Sort all bucket keys and cap to last 365 days worth of points (industry standard safety)
      const keys = Array.from(buckets.keys()).sort();
      const capped = keys.slice(Math.max(0, keys.length - 365));
      series = capped.map((k) => ({ date: k, scans: buckets.get(k) ?? 0 }));
    } else {
      // For fixed periods: fill in missing days so the chart doesn't have gaps
      const daysBack = Math.max(1, Number(period));
      const end = new Date(); // today
      const start = new Date();
      start.setDate(end.getDate() - (daysBack - 1));

      for (
        let cursor = new Date(start);
        cursor <= end;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const key = cursor.toISOString().slice(0, 10);
        series.push({ date: key, scans: buckets.get(key) ?? 0 });
      }
    }

    // Top performing QR codes
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
      series, // ✅ new
      topQRCodes,
    };
  } catch (error: any) {
    console.error("Analytics error:", error);
    return {
      error: error?.message || "Failed to fetch analytics",
      statusCode: 500,
    };
  }
});