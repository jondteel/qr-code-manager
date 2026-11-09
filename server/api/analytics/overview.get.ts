// server/api/analytics/overview.get.ts
import prisma from "~/server/utils/prisma";
import { requireEmailAccount } from "~/server/utils/require-email-account";
import { createError, getQuery } from "h3";
import { analyticsWindow, parseAnalyticsPeriod, growth, chartWindow, dailySeries } from "~/server/utils/analytics-window.mjs";

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
    const chart = chartWindow(window);


    // Keep QR-linked history across lifecycle states. The short-link FK does not grant attribution.
    // PostgreSQL's timestamp column stores UTC wall-clock values without a time zone.
    const [summary] = await prisma.$queryRaw<Array<{
      totalScans: bigint;
      previousScans: bigint;
      activeQRCodes: bigint;
      buckets: { date: string; scans: number }[];
      topQRCodes: { id: string; title: string; lifecycleStatus: string; data: string; scanCount: number }[];
    }>>`
      WITH bounds AS (
        SELECT
          ${window.start?.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC' AS current_start,
          ${window.end.toISOString()}::timestamptz AT TIME ZONE 'UTC' AS current_end,
          ${window.previous?.start.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC' AS previous_start,
          ${window.previous?.end.toISOString() ?? null}::timestamptz AT TIME ZONE 'UTC' AS previous_end,
          ${chart.start.toISOString()}::timestamptz AT TIME ZONE 'UTC' AS chart_start
      ), owned_qrs AS (
        SELECT id FROM public."QRCode" WHERE "userId" = ${user.sub}
      ), qr_counts AS (
        SELECT q.id,
          count(*) FILTER (WHERE a."timestamp" IS NOT NULL
            AND (b.current_start IS NULL OR a."timestamp" >= b.current_start)) AS current_count,
          count(*) FILTER (WHERE a."timestamp" < b.previous_end) AS previous_count
        FROM owned_qrs q
        CROSS JOIN bounds b
        LEFT JOIN public."Analytics" a ON a."qrCodeId" = q.id
          AND a."timestamp" < b.current_end
          AND (b.previous_start IS NULL OR a."timestamp" >= b.previous_start)
        GROUP BY q.id
      ), top_qrs AS (
        SELECT q.id, q.title, q."lifecycleStatus", q.data, ranked.current_count AS "scanCount"
        FROM (
          SELECT id, current_count FROM qr_counts ORDER BY current_count DESC, id LIMIT 10
        ) ranked
        JOIN public."QRCode" q ON q.id = ranked.id
      ), daily AS (
        SELECT a."timestamp"::date AS day, count(*) AS scans
        FROM public."Analytics" a
        JOIN owned_qrs q ON q.id = a."qrCodeId"
        CROSS JOIN bounds b
        WHERE a."timestamp" >= b.chart_start AND a."timestamp" < b.current_end
        GROUP BY a."timestamp"::date
      )
      SELECT
        coalesce(sum(current_count), 0)::bigint AS "totalScans",
        coalesce(sum(previous_count), 0)::bigint AS "previousScans",
        count(*) FILTER (WHERE current_count > 0) AS "activeQRCodes",
        (SELECT coalesce(jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'scans', scans)
          ORDER BY day), '[]'::jsonb) FROM daily) AS buckets,
        (SELECT coalesce(jsonb_agg(t ORDER BY t."scanCount" DESC, t.id), '[]'::jsonb) FROM top_qrs t) AS "topQRCodes"
      FROM qr_counts
    `;

    const totalScans = Number(summary.totalScans);
    const previousScans = window.previous ? Number(summary.previousScans) : null;
    const comparison = growth(totalScans, previousScans, false);
    const series = dailySeries(summary.buckets, chart);

    return {
      success: true,
      stats: {
        totalScans,
        uniqueVisitors: null,
        activeQRCodes: Number(summary.activeQRCodes),
        avgScansPerDay: null,
        scanGrowth: comparison.value,
      },
      series,
      range: { ...window, chart, previousScans, growthStatus: comparison.status, coverage: "unknown" },
      topQRCodes: summary.topQRCodes,
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