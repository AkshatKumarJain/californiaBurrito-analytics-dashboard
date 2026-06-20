import type { Request, Response } from "express";
import { z } from "zod";

import {
  getCategorySales,
  getChannelMix,
  getDashboardData,
  getFilterOptions,
  getInsights,
  getOutletPerformance,
  getRevenueTrend,
  getSummary,
  getTopItems,
} from "../services/analytics.service";
import type { Granularity } from "../types/analytics";
import { parseSalesFilters } from "../utils/filters";

const granularitySchema = z.enum(["day", "week", "month"]).default("day");
const topItemsLimitSchema = z.coerce.number().int().min(5).max(50).default(10);

function parseGranularity(value: unknown): Granularity {
  return granularitySchema.parse(value ?? "day");
}

export async function filtersController(_req: Request, res: Response): Promise<void> {
  res.json(await getFilterOptions());
}

export async function dashboardController(req: Request, res: Response): Promise<void> {
  const filters = parseSalesFilters(req.query);
  const granularity = parseGranularity(req.query.granularity);
  const topItemsLimit = topItemsLimitSchema.parse(req.query.limit);

  res.json(await getDashboardData(filters, granularity, topItemsLimit));
}

export async function insightsController(req: Request, res: Response): Promise<void> {
  const filters = parseSalesFilters(req.query);
  const granularity = parseGranularity(req.query.granularity);

  res.json(await getInsights(filters, granularity));
}

export async function summaryController(req: Request, res: Response): Promise<void> {
  const filters = parseSalesFilters(req.query);
  res.json(await getSummary(filters));
}

export async function trendController(req: Request, res: Response): Promise<void> {
  const filters = parseSalesFilters(req.query);
  const granularity = parseGranularity(req.query.granularity);
  res.json(await getRevenueTrend(filters, granularity));
}

export async function categorySalesController(
  req: Request,
  res: Response,
): Promise<void> {
  const filters = parseSalesFilters(req.query);
  res.json(await getCategorySales(filters));
}

export async function outletPerformanceController(
  req: Request,
  res: Response,
): Promise<void> {
  const filters = parseSalesFilters(req.query);
  res.json(await getOutletPerformance(filters));
}

export async function channelMixController(
  req: Request,
  res: Response,
): Promise<void> {
  const filters = parseSalesFilters(req.query);
  res.json(await getChannelMix(filters));
}

export async function topItemsController(req: Request, res: Response): Promise<void> {
  const filters = parseSalesFilters(req.query);
  const limit = topItemsLimitSchema.parse(req.query.limit);
  res.json(await getTopItems(filters, limit));
}
