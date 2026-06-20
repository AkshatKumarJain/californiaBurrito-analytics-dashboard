import type { ParsedQs } from "qs";

import type { SalesFilters } from "../types/analytics";

type QueryValue = ParsedQs[string];

function firstString(value: QueryValue): string | undefined {
  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (Array.isArray(value)) {
    const match = value.find((item) => typeof item === "string") as
      | string
      | undefined;
    return match?.trim() || undefined;
  }

  return undefined;
}

function dateOnly(value: QueryValue): string | undefined {
  const raw = firstString(value);
  if (!raw) {
    return undefined;
  }

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso?.[1];
}

function list(value: QueryValue, limit = 25): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const flattened = values.flatMap((item) =>
    typeof item === "string" ? item.split(",") : [],
  );

  return [...new Set(flattened.map((item) => item.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
}

function shortSearch(value: QueryValue): string | undefined {
  const raw = firstString(value);
  if (!raw) {
    return undefined;
  }

  return raw.replace(/\s+/g, " ").trim().slice(0, 80) || undefined;
}

export function parseSalesFilters(query: ParsedQs): SalesFilters {
  return {
    from: dateOnly(query.from),
    to: dateOnly(query.to),
    outlets: list(query.outlet ?? query.outlets ?? query.outletName),
    brands: list(query.brand ?? query.brands),
    groups: list(query.group ?? query.groups ?? query.category),
    orderTypes: list(query.orderType ?? query.orderTypes),
    settlements: list(query.settlement ?? query.settlements),
    itemSearch: shortSearch(query.item ?? query.itemSearch ?? query.q),
  };
}

export function buildSalesWhere(filters: SalesFilters): {
  whereSql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.from) {
    clauses.push("order_datetime >= ?");
    params.push(`${filters.from} 00:00:00`);
  }

  if (filters.to) {
    clauses.push("order_datetime <= ?");
    params.push(`${filters.to} 23:59:59`);
  }

  if (filters.itemSearch) {
    clauses.push("item LIKE ?");
    params.push(`%${filters.itemSearch}%`);
  }

  const listFilters: Array<[string, string[]]> = [
    ["outlet_name", filters.outlets],
    ["brand", filters.brands],
    ["item_group", filters.groups],
    ["order_type", filters.orderTypes],
    ["settlement", filters.settlements],
  ];

  for (const [column, values] of listFilters) {
    if (values.length === 0) {
      continue;
    }

    clauses.push(`${column} IN (${values.map(() => "?").join(", ")})`);
    params.push(...values);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function stableFilterKey(filters: SalesFilters): string {
  return JSON.stringify(filters);
}
