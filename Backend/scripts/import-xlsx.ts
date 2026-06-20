import path from "node:path";

// to handle excel data
import ExcelJS from "exceljs";
import type { ResultSetHeader } from "mysql2";

import { env } from "../src/config/env";
import { runMigrations } from "../src/db/migrate";
import { pool } from "../src/db/pool";
import { clearCache } from "../src/utils/cache";
import { parseOrderDate } from "../src/utils/date";

type HeaderKey =
  | "billNo"
  | "outletName"
  | "orderDatetime"
  | "group"
  | "orderType"
  | "item"
  | "price"
  | "quantity"
  | "settlement"
  | "brand";

type HeaderMap = Record<HeaderKey, number>;

const HEADER_ALIASES: Record<HeaderKey, string[]> = {
  billNo: ["billno", "bill no", "bill_no", "order id", "order_id"],
  outletName: ["outlet_name", "outlet name", "outlet"],
  orderDatetime: [
    "order_datetime",
    "order datetime",
    "order date",
    "datetime",
    "timestamp",
  ],
  group: ["group", "item group", "category", "item_group"],
  orderType: ["order_type", "order type", "type"],
  item: ["item", "item name", "menu item"],
  price: ["price", "unit price", "rate"],
  quantity: ["quantity", "qty"],
  settlement: ["settlement", "payment", "payment mode", "channel"],
  brand: ["brand"],
};

interface ImportOptions {
  file: string;
  truncate: boolean;
  batchSize: number;
  limit?: number;
}

interface CleanRow {
  billNo: string;
  outletName: string;
  brand: string;
  orderDatetime: string;
  group: string;
  orderType: string;
  item: string;
  price: number;
  quantity: number;
  settlement: string;
  lineRevenue: number;
}

// function for reading argument from data rows
function readArg(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) {
    return exact.slice(name.length + 1);
  }

  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1];
  }

  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readImportOptions(): ImportOptions {
  const fileFromArgs = readArg("--file");
  const file = fileFromArgs ?? env.dataFile;

  if (!file) {
    throw new Error("Pass --file <path-to-xlsx> or set DATA_FILE in .env.");
  }

  const batchSizeArg = Number(readArg("--batch-size"));
  const limitArg = Number(readArg("--limit"));

  return {
    file: path.isAbsolute(file) ? file : path.resolve(process.cwd(), file),
    truncate: hasFlag("--truncate"),
    batchSize: Number.isFinite(batchSizeArg) && batchSizeArg > 0
      ? Math.floor(batchSizeArg)
      : env.importBatchSize,
    limit: Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : undefined,
  };
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function primitiveValue(value: ExcelJS.CellValue | undefined): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date || typeof value !== "object") {
    return value;
  }

  if ("result" in value) {
    return primitiveValue(value.result as ExcelJS.CellValue | undefined);
  }

  if ("richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }

  if ("text" in value) {
    return value.text;
  }

  return String(value);
}

function textValue(value: ExcelJS.CellValue | undefined, fallback = "Unknown"): string {
  const primitive = primitiveValue(value);
  if (primitive === null || primitive === undefined) {
    return fallback;
  }

  const text = String(primitive).replace(/\s+/g, " ").trim();
  return text || fallback;
}

function numberValue(value: ExcelJS.CellValue | undefined): number {
  const primitive = primitiveValue(value);

  if (typeof primitive === "number") {
    return Number.isFinite(primitive) ? primitive : 0;
  }

  if (typeof primitive !== "string") {
    return 0;
  }

  const parsed = Number(primitive.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildHeaderMap(values: ExcelJS.CellValue[]): HeaderMap {
  const normalizedToIndex = new Map<string, number>();

  values.forEach((value, index) => {
    if (index === 0) {
      return;
    }

    const normalized = normalizeHeader(textValue(value, ""));
    if (normalized) {
      normalizedToIndex.set(normalized, index);
    }
  });

  const result = {} as Partial<HeaderMap>;

  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [HeaderKey, string[]]
  >) {
    const match = aliases
      .map(normalizeHeader)
      .map((alias) => normalizedToIndex.get(alias))
      .find((index) => index !== undefined);

    if (!match) {
      throw new Error(`Missing required column for ${key}.`);
    }

    result[key] = match;
  }

  return result as HeaderMap;
}

function cleanRow(values: ExcelJS.CellValue[], headers: HeaderMap): CleanRow | null {
  const billNo = textValue(values[headers.billNo], "");
  const item = textValue(values[headers.item], "");
  const orderDatetime = parseOrderDate(primitiveValue(values[headers.orderDatetime]));

  if (!billNo || !item || !orderDatetime) {
    return null;
  }

  const price = money(numberValue(values[headers.price]));
  const quantity = Math.trunc(numberValue(values[headers.quantity]));
  const lineRevenue = money(price * quantity);

  return {
    billNo,
    outletName: textValue(values[headers.outletName]),
    brand: textValue(values[headers.brand]),
    orderDatetime,
    group: textValue(values[headers.group]),
    orderType: textValue(values[headers.orderType]),
    item,
    price,
    quantity,
    settlement: textValue(values[headers.settlement]),
    lineRevenue,
  };
}


// query for inserting batches of data
async function insertBatch(rows: CleanRow[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const values = rows.map((row) => [
    row.billNo,
    row.outletName,
    row.brand,
    row.orderDatetime,
    row.group,
    row.orderType,
    row.item,
    row.price,
    row.quantity,
    row.settlement,
    row.lineRevenue,
  ]);

  const [result] = await pool.query<ResultSetHeader>(
    `
      INSERT INTO sales_line_items (
        bill_no,
        outlet_name,
        brand,
        order_datetime,
        item_group,
        order_type,
        item,
        price,
        quantity,
        settlement,
        line_revenue
      )
      VALUES ?
    `,
    [values],
  );

  return result.affectedRows;
}

function logProgress(seen: number, inserted: number, skipped: number): void {
  const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.log(
    `Processed ${seen.toLocaleString()} rows | inserted ${inserted.toLocaleString()} | skipped ${skipped.toLocaleString()} | rss ${memoryMb} MB`,
  );
}

async function importWorkbook(options: ImportOptions): Promise<void> {
  await runMigrations();

  if (options.truncate) {
    await pool.query("TRUNCATE TABLE sales_line_items");
    console.log("Existing sales_line_items data truncated.");
  }

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(options.file, {
    entries: "emit",
    sharedStrings: "cache",
    styles: "ignore",
    hyperlinks: "ignore",
    worksheets: "emit",
  });

  let headers: HeaderMap | null = null;
  let batch: CleanRow[] = [];
  let seen = 0;
  let inserted = 0;
  let skipped = 0;

  for await (const worksheetReader of workbookReader) {
    for await (const row of worksheetReader) {
      const values = row.values as ExcelJS.CellValue[];

      if (!headers) {
        headers = buildHeaderMap(values);
        console.log("Detected workbook columns.");
        continue;
      }

      seen += 1;

      const cleaned = cleanRow(values, headers);
      if (!cleaned) {
        skipped += 1;
        continue;
      }

      batch.push(cleaned);

      if (batch.length >= options.batchSize) {
        inserted += await insertBatch(batch);
        batch = [];
      }

      if (seen % 10_000 === 0) {
        logProgress(seen, inserted, skipped);
      }

      if (options.limit && seen >= options.limit) {
        break;
      }
    }

    if (options.limit && seen >= options.limit) {
      break;
    }
  }

  inserted += await insertBatch(batch);
  logProgress(seen, inserted, skipped);
}

async function main(): Promise<void> {
  const options = readImportOptions();
  console.log(`Importing ${options.file}`);
  console.log(`Batch size: ${options.batchSize}`);
  await clearCache();
  await importWorkbook(options);
  await clearCache();
}

main()
  .catch((error) => {
    console.error("Import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
