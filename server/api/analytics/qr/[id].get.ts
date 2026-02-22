// server/api/analytics/qr/[id].get.ts
import prisma from "~/server/utils/prisma";
import { serverSupabaseUser } from "#supabase/server";
import { createError, getQuery, getRouterParam } from "h3";

type PeriodValue = 7 | 30 | 90 | "all";

function parsePeriod(raw: unknown): PeriodValue {
  if (raw === "all") return "all";

  const n = Number(raw ?? 30);
  if (n === 7 || n === 30 || n === 90) return n;

  return 30; // safe default
}

export default defineEventHandler(async (event) => {
  try {
    const user = await serverSupabaseUser(event);
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
    const period = parsePeriod(query.period);

    // Date range
    let startDate: Date;
    if (period === "all") {
      startDate = new Date(0);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
    }

    // Ensure the QR belongs to this user
    const qr = await prisma.qRCode.findFirst({
      where: { id, userId: user.sub },
      select: {
        id: true,
        title: true,
        data: true,
        createdAt: true,
        shortUrl: {
          select: {
            shortCode: true,
          },
        },
      },
    });

    if (!qr) {
      throw createError({
        statusCode: 404,
        statusMessage: "QR code not found",
      });
    }

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
      },
    });

    const totalScans = scans.length;

    // Unique visitors based on IP (skip unknowns)
    const uniqueIPs = new Set<string>();
    for (const s of scans) {
      if (s.ipAddress && s.ipAddress !== "unknown") {
        uniqueIPs.add(s.ipAddress);
      }
    }
    const uniqueVisitors = uniqueIPs.size;

    // Avg scans/day
    const days =
      period === "all"
        ? Math.max(
            1,
            Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          )
        : period;

    const avgScansPerDay = Math.round(totalScans / days);

    // Bucket by day (UTC day keys)
    const buckets = new Map<string, number>(); // YYYY-MM-DD -> count
    for (const s of scans) {
      const key = new Date(s.timestamp).toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    let series: Array<{ date: string; scans: number }> = [];

    if (period === "all") {
      const keys = Array.from(buckets.keys()).sort();
      const capped = keys.slice(Math.max(0, keys.length - 365)); // cap payload
      series = capped.map((k) => ({ date: k, scans: buckets.get(k) ?? 0 }));
    } else {
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

    // Latest scans table (cap payload)
    const recentScans = scans.slice(0, 50);

    return {
      success: true,
      qr: {
        id: qr.id,
        title: qr.title,
        data: qr.data,
        createdAt: qr.createdAt,
        shortUrl: qr.shortUrl ? { shortCode: qr.shortUrl.shortCode } : null,
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
    // Preserve H3/Nuxt errors with status codes
    if (error?.statusCode) throw error;

    console.error("QR analytics error:", error);

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch QR analytics",
    });
  }
});