import axios from "axios";

import type {
  AuthMeResponse,
  AuthResult,
  AuthUser,
  DashboardData,
  DashboardFilters,
  FilterOptions,
  Granularity,
  InsightsResponse,
  LoginPayload,
  RegisterPayload,
} from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api",
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function filterParams(filters: DashboardFilters): Record<string, string> {
  return Object.fromEntries(
    Object.entries({
      from: filters.from,
      to: filters.to,
      outlet: filters.outlet,
      brand: filters.brand,
      group: filters.group,
      orderType: filters.orderType,
      settlement: filters.settlement,
      itemSearch: filters.itemSearch,
      granularity: filters.granularity,
    }).filter(([, value]) => Boolean(value)),
  );
}

export function buildExportUrl(filters: DashboardFilters, limit = 500000): string {
  const params = new URLSearchParams({
    ...filterParams(filters),
    limit: String(limit),
  });

  return `${api.defaults.baseURL}/analytics/export.csv?${params.toString()}`;
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const { data } = await api.get<FilterOptions>("/analytics/filters");
  return data;
}

export async function fetchDashboard(
  filters: DashboardFilters,
  granularity: Granularity,
  limit = 10,
): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>("/analytics/dashboard", {
    params: {
      ...filterParams(filters),
      granularity,
      limit,
    },
  });
  return data;
}

export async function fetchInsights(
  filters: DashboardFilters,
  granularity: Granularity,
): Promise<InsightsResponse> {
  const { data } = await api.get<InsightsResponse>("/analytics/insights", {
    params: {
      ...filterParams(filters),
      granularity,
    },
  });
  return data;
}

export async function fetchMe(): Promise<AuthMeResponse> {
  const { data } = await api.get<AuthMeResponse>("/auth/me");
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>("/auth/login", payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>("/auth/register", payload);
  return data;
}

export function saveToken(token: string): void {
  window.localStorage.setItem("auth_token", token);
}

export function clearToken(): void {
  window.localStorage.removeItem("auth_token");
}

export function getStoredUser(): AuthUser | null {
  const raw = window.localStorage.getItem("auth_user");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveUser(user: AuthUser): void {
  window.localStorage.setItem("auth_user", JSON.stringify(user));
}

export function clearUser(): void {
  window.localStorage.removeItem("auth_user");
}

export function downloadCsv(filters: DashboardFilters, limit = 500000): Promise<Blob> {
  return api
    .get("/analytics/export.csv", {
      params: {
        ...filterParams(filters),
        limit,
      },
      responseType: "blob",
    })
    .then((response) => response.data as Blob);
}
