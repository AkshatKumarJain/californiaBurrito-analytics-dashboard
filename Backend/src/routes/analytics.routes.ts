import { Router } from "express";

import {
  categorySalesController,
  channelMixController,
  dashboardController,
  filtersController,
  insightsController,
  outletPerformanceController,
  summaryController,
  topItemsController,
  trendController,
} from "../controllers/analytics.controller";
import { exportCsvController } from "../controllers/export.controller";
import { asyncHandler } from "../utils/async-handler";

export const analyticsRouter = Router();

analyticsRouter.get("/dashboard", asyncHandler(dashboardController));
analyticsRouter.get("/filters", asyncHandler(filtersController));
analyticsRouter.get("/summary", asyncHandler(summaryController));
analyticsRouter.get("/revenue-trend", asyncHandler(trendController));
analyticsRouter.get("/category-sales", asyncHandler(categorySalesController));
analyticsRouter.get("/outlet-performance", asyncHandler(outletPerformanceController));
analyticsRouter.get("/channel-mix", asyncHandler(channelMixController));
analyticsRouter.get("/top-items", asyncHandler(topItemsController));
analyticsRouter.get("/insights", asyncHandler(insightsController));
analyticsRouter.get("/export.csv", asyncHandler(exportCsvController));
