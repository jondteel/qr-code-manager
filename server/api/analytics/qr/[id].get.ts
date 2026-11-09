// server/api/analytics/qr/[id].get.ts
import type { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { requireEmailAccount } from "~/server/utils/require-email-account";
import { createError, getQuery, getRouterParam } from "h3";
import { analyticsWindow, parseAnalyticsPeriod, growth, chartWindow, dailySeries } from "~/server/utils/analytics-window.mjs";
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
    const chart = chartWindow(window);

    const { qr, summary, recentScans } = await readQrSnapshot(prisma, async (tx: Prisma.TransactionClient) => {
      const qr = await tx.qRCode.findFirst({
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
      });

      if (!qr) throw createError({ statusCode: 404, statusMessage: "QR code not found" });

      const [summary] = await tx.$queryRaw<Array<{
        totalScans: bigint;
        previousScans: bigint;
        buckets: { date: string; scans: number }[];
      }>>`
        WITH bounds AS (
          SELECT
            ${window.start?.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC' AS current_start,
            ${window.end.toISOString()}::timestamptz AT TIME ZONE 'UTC' AS current_end,
            ${window.previous?.start.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC' AS previous_start,
            ${window.previous?.end.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC' AS previous_end,
            ${chart.start.toISOString()}::timestamptz AT TIME ZONE 'UTC' AS chart_start
        ), scoped AS NOT MATERIALIZED (
          SELECT a."timestamp", b.*
          FROM public."Analytics" a
          JOIN public."QRCode" q ON q.id = a."qrCodeId"
          CROSS JOIN bounds b
          WHERE q.id = ${qr.id} AND q."userId" = ${user.sub}
            AND a."timestamp" < b.current_end
            AND (b.previous_start IS NULL OR a."timestamp" >= b.previous_start)
        ), daily AS (
          SELECT "timestamp"::date AS day, count(*) AS scans
          FROM scoped
          WHERE "timestamp" >= chart_start
          GROUP BY "timestamp"::date
        )
        SELECT
          count(*) FILTER (WHERE current_start IS NULL OR "timestamp" >= current_start) AS "totalScans",
          count(*) FILTER (WHERE "timestamp" < previous_end) AS "previousScans",
          (SELECT coalesce(jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'scans', scans)
            ORDER BY day), '[]'::jsonb) FROM daily) AS buckets
        FROM scoped
      `;

      const recentScans = await tx.analytics.findMany({
        where: {
          qrCodeId: qr.id,
          qrCode: { userId: user.sub },
          timestamp: { ...(window.start ? { gte: window.start } : {}), lt: window.end },
        },
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        take: 50,
        select: { id: true, timestamp: true, ipAddress: true, userAgent: true },
      });
      return { qr, summary, recentScans };
    });
    const presented = presentQr(qr, user.sub, useRuntimeConfig(event), process.env.VERCEL_ENV, serverQrStage(process.env));
    const totalScans = Number(summary.totalScans);
    const previousScans = window.previous ? Number(summary.previousScans) : null;
    const comparison = growth(totalScans, previousScans, false);
    const series = dailySeries(summary.buckets, chart);

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
        uniqueVisitors: null,
        avgScansPerDay: null,
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
