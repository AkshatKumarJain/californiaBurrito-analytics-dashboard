export type Granularity = "day" | "week" | "month";

export interface SalesFilters {
  from?: string;
  to?: string;
  outlets: string[];
  brands: string[];
  groups: string[];
  orderTypes: string[];
  settlements: string[];
  itemSearch?: string;
}

export interface SummaryMetrics {
  totalRecords: number;
  totalOrders: number;
  totalRevenue: number;
  totalQuantity: number;
  averageOrderValue: number;
  itemsPerOrder: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

export interface MetricPoint {
  name: string;
  revenue: number;
  quantity: number;
  orders: number;
}

export interface RevenueTrendPoint {
  bucket: string;
  revenue: number;
  orders: number;
  quantity: number;
}

export interface TopItemPoint extends MetricPoint {
  group: string;
  averagePrice: number;
}

export interface OutletPerformancePoint extends MetricPoint {
  brand: string;
  averageOrderValue: number;
}

export interface ChannelMix {
  orderTypes: MetricPoint[];
  settlements: MetricPoint[];
}

export interface DashboardData {
  summary: SummaryMetrics;
  trend: RevenueTrendPoint[];
  categories: MetricPoint[];
  outlets: OutletPerformancePoint[];
  channelMix: ChannelMix;
  topItems: TopItemPoint[];
}

export interface Insight {
  title: string;
  detail: string;
  severity: "positive" | "neutral" | "warning";
}
