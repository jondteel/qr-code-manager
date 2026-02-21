// server/api/analytics/qr/[id].get.ts
import prisma from "~/server/utils/prisma";
import { serverSupabaseUser } from "#supabase/server";

export default defineEventHandler(async (event) => {
  try {
    const user = await serverSupabaseUser(event);
    if (!user?.sub) {
      return { error: "Unauthorized", statusCode: 401 };
    }

    const id = getRouterParam(event, "id");
    if (!id) return { error: "Missing QR id", statusCode: 400 };

    const query = getQuery(event);
    const periodRaw = query.period ?? 30;
    const period = periodRaw === "all" ? "all" : Number(periodRaw);

    // date range
    let startDate: Date;
    if (period === "all") {
      startDate = new Date(0);
    } else {
      const daysBack = Number.isFinite(period) && period > 0 ? period : 30;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
    }

    // Ensure the QR belongs to this user
    const qr = await prisma.qRCode.findFirst({
      where: { id, userId: user.sub },
      include: { shortUrl: true },
    });

    if (!qr) return { error: "Not found", statusCode: 404 };

    // Pull scans for this QR (within period)
    const scans = await prisma.analytics.findMany({
      where: {
        qrCodeId: qr.id,
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        timestamp: true,
        ipAddress: true,
        userAgent: true,
        shortUrlId: true,
      },
    });

    const totalScans = scans.length;

    // unique visitors based on ipAddress (skip unknowns)
    const uniqueIPs = new Set<string>();
    for (const s of scans) {
      if (s.ipAddress && s.ipAddress !== "unknown") uniqueIPs.add(s.ipAddress);
    }
    const uniqueVisitors = uniqueIPs.size;

    // avg scans/day
    const days =
      period === "all"
        ? Math.max(
            1,
            Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          )
        : Math.max(1, Number(period));
    const avgScansPerDay = Math.round(totalScans / days);

    // bucket by day
    const buckets = new Map<string, number>(); // yyyy-mm-dd -> count
    for (const s of scans) {
      const key = new Date(s.timestamp).toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    let series: Array<{ date: string; scans: number }> = [];

    if (period === "all") {
      const keys = Array.from(buckets.keys()).sort();
      const capped = keys.slice(Math.max(0, keys.length - 365));
      series = capped.map((k) => ({ date: k, scans: buckets.get(k) ?? 0 }));
    } else {
      const daysBack = Math.max(1, Number(period));
      const end = new Date();
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

    // last N scans for table (cap payload)
    const recentScans = scans.slice(0, 50);

    return {
      success: true,
      qr: {
        id: qr.id,
        title: qr.title,
        data: qr.data,
        createdAt: qr.createdAt,
        shortUrl: qr.shortUrl
          ? { shortCode: qr.shortUrl.shortCode }
          : null,
      },
      stats: {
        totalScans,
        uniqueVisitors,
        avgScansPerDay,
      },
      series,
      recentScans,
    };
  } catch (error: any) {
    console.error("QR analytics error:", error);
    return {
      error: error?.message || "Failed to fetch QR analytics",
      statusCode: 500,
    };
  }
});