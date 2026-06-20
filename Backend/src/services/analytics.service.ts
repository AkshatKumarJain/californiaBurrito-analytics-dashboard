import type { RowDataPacket } from "mysql2";

import { env } from "../config/env";
import { pool } from "../db/pool";
import type {
  ChannelMix,
  DashboardData,
  Granularity,
  Insight,
  MetricPoint,
  OutletPerformancePoint,
  RevenueTrendPoint,
  SalesFilters,
  SummaryMetrics,
  TopItemPoint,
} from "../types/analytics";
import { getCached } from "../utils/cache";
import { buildSalesWhere, stableFilterKey } from "../utils/filters";

interface SummaryRow extends RowDataPacket {
  totalRecords: number;
  totalOrders: number;
  totalRevenue: number;
  totalQuantity: number;
  averageOrderValue: number;
  itemsPerOrder: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

interface MetricRow extends RowDataPacket {
  name: string;
  revenue: number;
  quantity: number;
  orders: number;
}

interface OutletPerformanceRow extends MetricRow {
  brand: string;
  averageOrderValue: number;
}

interface TopItemRow extends MetricRow {
  itemGroup: string;
  averagePrice: number;
}

interface TrendRow extends RowDataPacket {
  bucket: string;
  revenue: number;
  orders: number;
  quantity: number;
}

interface FilterValueRow extends RowDataPacket {
  value: string;
}

interface DateRangeRow extends RowDataPacket {
  minDate: string | null;
  maxDate: string | null;
}

function numberValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function queryRows<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const [rows] = await pool.query<T[]>(sql, params);
  return rows;
}

function cacheKey(scope: string, filters?: SalesFilters, extra?: unknown): string {
  return `${scope}:${filters ? stableFilterKey(filters) : "all"}:${
    extra ? JSON.stringify(extra) : ""
  }`;
}

function toMetricPoint(row: MetricRow): MetricPoint {
  return {
    name: row.name,
    revenue: numberValue(row.revenue),
    quantity: numberValue(row.quantity),
    orders: numberValue(row.orders),
  };
}

function percentShare(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

export async function getSummary(filters: SalesFilters): Promise<SummaryMetrics> {
  return getCached(cacheKey("summary", filters), env.cacheTtlSeconds, async () => {
    const { whereSql, params } = buildSalesWhere(filters);
    const rows = await queryRows<SummaryRow>(
      `
        SELECT
          COUNT(*) AS totalRecords,
          COUNT(DISTINCT bill_no) AS totalOrders,
          COALESCE(SUM(line_revenue), 0) AS totalRevenue,
          COALESCE(SUM(quantity), 0) AS totalQuantity,
          COALESCE(SUM(line_revenue) / NULLIF(COUNT(DISTINCT bill_no), 0), 0) AS averageOrderValue,
          COALESCE(SUM(quantity) / NULLIF(COUNT(DISTINCT bill_no), 0), 0) AS itemsPerOrder,
          DATE_FORMAT(MIN(order_datetime), '%Y-%m-%d %H:%i:%s') AS firstOrderAt,
          DATE_FORMAT(MAX(order_datetime), '%Y-%m-%d %H:%i:%s') AS lastOrderAt
        FROM sales_line_items
        ${whereSql}
      `,
      params,
    );

    const row = rows[0];
    return {
      totalRecords: numberValue(row?.totalRecords),
      totalOrders: numberValue(row?.totalOrders),
      totalRevenue: numberValue(row?.totalRevenue),
      totalQuantity: numberValue(row?.totalQuantity),
      averageOrderValue: numberValue(row?.averageOrderValue),
      itemsPerOrder: numberValue(row?.itemsPerOrder),
      firstOrderAt: row?.firstOrderAt ?? null,
      lastOrderAt: row?.lastOrderAt ?? null,
    };
  });
}

export async function getRevenueTrend(
  filters: SalesFilters,
  granularity: Granularity,
): Promise<RevenueTrendPoint[]> {
  return getCached(
    cacheKey("trend", filters, { granularity }),
    env.cacheTtlSeconds,
    async () => {
      const { whereSql, params } = buildSalesWhere(filters);
      const bucketExpression =
        granularity === "month"
          ? "DATE_FORMAT(order_datetime, '%Y-%m-01')"
          : granularity === "week"
            ? "DATE_FORMAT(DATE_SUB(order_datetime, INTERVAL WEEKDAY(order_datetime) DAY), '%Y-%m-%d')"
            : "DATE_FORMAT(order_datetime, '%Y-%m-%d')";

      const rows = await queryRows<TrendRow>(
        `
          SELECT
            ${bucketExpression} AS bucket,
            COALESCE(SUM(line_revenue), 0) AS revenue,
            COUNT(DISTINCT bill_no) AS orders,
            COALESCE(SUM(quantity), 0) AS quantity
          FROM sales_line_items
          ${whereSql}
          GROUP BY bucket
          ORDER BY bucket ASC
        `,
        params,
      );

      return rows.map((row) => ({
        bucket: row.bucket,
        revenue: numberValue(row.revenue),
        orders: numberValue(row.orders),
        quantity: numberValue(row.quantity),
      }));
    },
  );
}

export async function getCategorySales(
  filters: SalesFilters,
): Promise<MetricPoint[]> {
  return getCached(cacheKey("categories", filters), env.cacheTtlSeconds, async () => {
    const { whereSql, params } = buildSalesWhere(filters);
    const rows = await queryRows<MetricRow>(
      `
        SELECT
          item_group AS name,
          COALESCE(SUM(line_revenue), 0) AS revenue,
          COALESCE(SUM(quantity), 0) AS quantity,
          COUNT(DISTINCT bill_no) AS orders
        FROM sales_line_items
        ${whereSql}
        GROUP BY item_group
        ORDER BY revenue DESC
        LIMIT 12
      `,
      params,
    );

    return rows.map(toMetricPoint);
  });
}

export async function getOutletPerformance(
  filters: SalesFilters,
): Promise<OutletPerformancePoint[]> {
  return getCached(cacheKey("outlets", filters), env.cacheTtlSeconds, async () => {
    const { whereSql, params } = buildSalesWhere(filters);
    const rows = await queryRows<OutletPerformanceRow>(
      `
        SELECT
          outlet_name AS name,
          brand AS brand,
          COALESCE(SUM(line_revenue), 0) AS revenue,
          COALESCE(SUM(quantity), 0) AS quantity,
          COUNT(DISTINCT bill_no) AS orders,
          COALESCE(SUM(line_revenue) / NULLIF(COUNT(DISTINCT bill_no), 0), 0) AS averageOrderValue
        FROM sales_line_items
        ${whereSql}
        GROUP BY outlet_name, brand
        ORDER BY revenue DESC
        LIMIT 20
      `,
      params,
    );

    return rows.map((row) => ({
      ...toMetricPoint(row),
      brand: row.brand,
      averageOrderValue: numberValue(row.averageOrderValue),
    }));
  });
}

async function getDimensionMix(
  filters: SalesFilters,
  column: "order_type" | "settlement",
): Promise<MetricPoint[]> {
  const { whereSql, params } = buildSalesWhere(filters);
  const rows = await queryRows<MetricRow>(
    `
      SELECT
        ${column} AS name,
        COALESCE(SUM(line_revenue), 0) AS revenue,
        COALESCE(SUM(quantity), 0) AS quantity,
        COUNT(DISTINCT bill_no) AS orders
      FROM sales_line_items
      ${whereSql}
      GROUP BY ${column}
      ORDER BY revenue DESC
      LIMIT 12
    `,
    params,
  );

  return rows.map(toMetricPoint);
}

export async function getChannelMix(filters: SalesFilters): Promise<ChannelMix> {
  return getCached(cacheKey("channel-mix", filters), env.cacheTtlSeconds, async () => {
    const [orderTypes, settlements] = await Promise.all([
      getDimensionMix(filters, "order_type"),
      getDimensionMix(filters, "settlement"),
    ]);

    return { orderTypes, settlements };
  });
}

export async function getTopItems(
  filters: SalesFilters,
  limit: number,
): Promise<TopItemPoint[]> {
  return getCached(cacheKey("top-items", filters, { limit }), env.cacheTtlSeconds, async () => {
    const { whereSql, params } = buildSalesWhere(filters);
    const rows = await queryRows<TopItemRow>(
      `
        SELECT
          item AS name,
          item_group AS itemGroup,
          COALESCE(SUM(line_revenue), 0) AS revenue,
          COALESCE(SUM(quantity), 0) AS quantity,
          COUNT(DISTINCT bill_no) AS orders,
          COALESCE(AVG(price), 0) AS averagePrice
        FROM sales_line_items
        ${whereSql}
        GROUP BY item, item_group
        ORDER BY revenue DESC
        LIMIT ?
      `,
      [...params, limit],
    );

    return rows.map((row) => ({
      ...toMetricPoint(row),
      group: row.itemGroup,
      averagePrice: numberValue(row.averagePrice),
    }));
  });
}

export async function getFilterOptions(): Promise<{
  outlets: string[];
  brands: string[];
  groups: string[];
  orderTypes: string[];
  settlements: string[];
  minDate: string | null;
  maxDate: string | null;
}> {
  return getCached("filters", env.cacheTtlSeconds * 5, async () => {
    const distinctSql = (column: string) => `
      SELECT DISTINCT ${column} AS value
      FROM sales_line_items
      WHERE ${column} IS NOT NULL AND ${column} <> ''
      ORDER BY ${column} ASC
      LIMIT 500
    `;

    const [outlets, brands, groups, orderTypes, settlements, ranges] =
      await Promise.all([
        queryRows<FilterValueRow>(distinctSql("outlet_name")),
        queryRows<FilterValueRow>(distinctSql("brand")),
        queryRows<FilterValueRow>(distinctSql("item_group")),
        queryRows<FilterValueRow>(distinctSql("order_type")),
        queryRows<FilterValueRow>(distinctSql("settlement")),
        queryRows<DateRangeRow>(`
          SELECT
            DATE_FORMAT(MIN(order_datetime), '%Y-%m-%d') AS minDate,
            DATE_FORMAT(MAX(order_datetime), '%Y-%m-%d') AS maxDate
          FROM sales_line_items
        `),
      ]);

    return {
      outlets: outlets.map((row) => row.value),
      brands: brands.map((row) => row.value),
      groups: groups.map((row) => row.value),
      orderTypes: orderTypes.map((row) => row.value),
      settlements: settlements.map((row) => row.value),
      minDate: ranges[0]?.minDate ?? null,
      maxDate: ranges[0]?.maxDate ?? null,
    };
  });
}

export async function getDashboardData(
  filters: SalesFilters,
  granularity: Granularity,
  topItemsLimit: number,
): Promise<DashboardData> {
  return getCached(
    cacheKey("dashboard", filters, { granularity, topItemsLimit }),
    env.cacheTtlSeconds,
    async () => {
      const [summary, trend, categories, outlets, channelMix, topItems] =
        await Promise.all([
          getSummary(filters),
          getRevenueTrend(filters, granularity),
          getCategorySales(filters),
          getOutletPerformance(filters),
          getChannelMix(filters),
          getTopItems(filters, topItemsLimit),
        ]);

      return {
        summary,
        trend,
        categories,
        outlets,
        channelMix,
        topItems,
      };
    },
  );
}

function buildRuleBasedInsights(data: DashboardData): Insight[] {
  const insights: Insight[] = [];
  const topOutlet = data.outlets[0];
  const topCategory = data.categories[0];
  const topItem = data.topItems[0];
  const topOrderType = data.channelMix.orderTypes[0];
  const latestTrend = data.trend[data.trend.length - 1];
  const previousTrend = data.trend[data.trend.length - 2];

  if (topOutlet) {
    insights.push({
      title: "Outlet concentration",
      detail: `${topOutlet.name} leads with ${percentShare(
        topOutlet.revenue,
        data.summary.totalRevenue,
      )}% of filtered revenue and an average order value of ${Math.round(
        topOutlet.averageOrderValue,
      )}.`,
      severity: "positive",
    });
  }

  if (topCategory) {
    insights.push({
      title: "Category leader",
      detail: `${topCategory.name} contributes ${percentShare(
        topCategory.revenue,
        data.summary.totalRevenue,
      )}% of revenue across ${topCategory.orders.toLocaleString("en-IN")} orders.`,
      severity: "positive",
    });
  }

  if (topItem) {
    insights.push({
      title: "Menu item opportunity",
      detail: `${topItem.name} is the top item by revenue. Keep it visible in combos and promos.`,
      severity: "neutral",
    });
  }

  if (topOrderType) {
    insights.push({
      title: "Channel mix",
      detail: `${topOrderType.name} accounts for ${percentShare(
        topOrderType.revenue,
        data.summary.totalRevenue,
      )}% of revenue.`,
      severity: "neutral",
    });
  }

  if (latestTrend && previousTrend) {
    const change = latestTrend.revenue - previousTrend.revenue;
    const changePercent = percentShare(Math.abs(change), previousTrend.revenue);

    insights.push({
      title: change >= 0 ? "Recent momentum" : "Recent slowdown",
      detail:
        change >= 0
          ? `Latest period revenue is up ${changePercent}% versus the previous period.`
          : `Latest period revenue is down ${changePercent}% versus the previous period. Review staffing, channel mix, and offers.`,
      severity: change >= 0 ? "positive" : "warning",
    });
  }

  if (data.summary.itemsPerOrder < 2) {
    insights.push({
      title: "Attach-rate watch",
      detail:
        "Items per order are below 2. Consider combo prompts or side and drink add-ons at checkout.",
      severity: "warning",
    });
  }

  return insights.slice(0, 6);
}

async function getOpenAiInsights(data: DashboardData): Promise<Insight[] | null> {
  if (!env.openAiApiKey) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.openAiModel,
        input: [
          {
            role: "system",
            content:
              "Return concise analytics insights as JSON with an insights array. Each insight must contain title, detail, and severity.",
          },
          {
            role: "user",
            content: JSON.stringify({
              summary: data.summary,
              topCategories: data.categories.slice(0, 5),
              topOutlets: data.outlets.slice(0, 5),
              topItems: data.topItems.slice(0, 5),
              channelMix: data.channelMix,
              recentTrend: data.trend.slice(-8),
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "analytics_insights",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["insights"],
              properties: {
                insights: {
                  type: "array",
                  maxItems: 6,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "detail", "severity"],
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string" },
                      severity: {
                        type: "string",
                        enum: ["positive", "neutral", "warning"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}`);
    }

    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    const outputText =
      result.output_text ??
      result.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === "output_text")?.text;

    if (!outputText) {
      return null;
    }

    const parsed = JSON.parse(outputText) as { insights?: Insight[] };
    return parsed.insights?.slice(0, 6) ?? null;
  } catch (error) {
    console.warn(
      `OpenAI insights unavailable, using rule-based insights: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return null;
  }
}

export async function getInsights(
  filters: SalesFilters,
  granularity: Granularity,
): Promise<{
  source: "openai" | "rules";
  insights: Insight[];
}> {
  return getCached(
    cacheKey("insights", filters, { granularity, openAi: Boolean(env.openAiApiKey) }),
    env.cacheTtlSeconds * 5,
    async () => {
      const data = await getDashboardData(filters, granularity, 10);
      const openAiInsights = await getOpenAiInsights(data);

      if (openAiInsights?.length) {
        return { source: "openai" as const, insights: openAiInsights };
      }

      return { source: "rules" as const, insights: buildRuleBasedInsights(data) };
    },
  );
}
