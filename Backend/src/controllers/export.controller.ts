import type { Request, Response } from "express";
import { z } from "zod";

import { streamSalesCsv } from "../services/export.service";
import { parseSalesFilters } from "../utils/filters";

const exportLimitSchema = z.coerce.number().int().min(1).max(500000).default(500000);

export async function exportCsvController(req: Request, res: Response): Promise<void> {
  const filters = parseSalesFilters(req.query);
  const limit = exportLimitSchema.parse(req.query.limit);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="sales-export.csv"');
  res.setHeader("Cache-Control", "no-store");

  await streamSalesCsv(res, filters, limit);
}
