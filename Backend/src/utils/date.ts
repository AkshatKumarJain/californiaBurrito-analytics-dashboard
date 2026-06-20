const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatDateParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): string {
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(
    second,
  )}`;
}

function formatDate(date: Date): string {
  return formatDateParts(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  );
}

function formatUtcDate(date: Date): string {
  return formatDateParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );
}

function parseExcelSerial(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const date = new Date(EXCEL_EPOCH_UTC + Math.round(value * DAY_IN_MS));
  return formatUtcDate(date);
}

export function parseOrderDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value);
  }

  if (typeof value === "number") {
    return parseExcelSerial(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const ddmmyyyy = trimmed.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );

  if (ddmmyyyy) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] =
      ddmmyyyy;
    return formatDateParts(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatDate(parsed);
}
