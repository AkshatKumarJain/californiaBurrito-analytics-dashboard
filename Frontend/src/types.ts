export type Granularity = "day" | "week" | "month";

export interface DashboardFilters {
  from: string;
  to: string;
  outlet: string;
  brand: string;
  group: string;
  orderType: string;
  settlement: string;
  itemSearch: string;
  granularity: Granularity;
}

export interface FilterOptions {
  outlets: string[];
  brands: string[];
  groups: string[];
  orderTypes: string[];
  settlements: string[];
  minDate: string | null;
  maxDate: string | null;
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
  quantity: number;
  orders: number;
}

export interface OutletPerformancePoint extends MetricPoint {
  brand: string;
  averageOrderValue: number;
}

export interface TopItemPoint extends MetricPoint {
  group: string;
  averagePrice: number;
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

export interface InsightsResponse {
  source: "openai" | "rules";
  insights: Insight[];
}

export interface CacheStatus {
  provider: "redis" | "memory";
  status: "connected" | "fallback" | "disabled";
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "analyst";
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export interface AuthMeResponse {
  user: AuthUser | null;
  authRequired: boolean;
  authAllowRegistration: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  name: string;
}
