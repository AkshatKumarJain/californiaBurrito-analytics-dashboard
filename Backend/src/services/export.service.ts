import type { Response } from "express";
import mysql, { type ConnectionOptions, type RowDataPacket } from "mysql2";

import { env } from "../config/env";
import type { SalesFilters } from "../types/analytics";
import { buildSalesWhere } from "../utils/filters";

interface ExportRow extends RowDataPacket {
  bill_no: string;
  outlet_name: string;
  brand: string;
  order_datetime: string;
  item_group: string;
  order_type: string;
  item: string;
  price: number;
  quantity: number;
  settlement: string;
  line_revenue: number;
}

function connectionOptions(): ConnectionOptions {
  const ssl = env.dbSsl
    ? {
        rejectUnauthorized: env.dbSslRejectUnauthorized,
      }
    : undefined;

  if (env.databaseUrl) {
    return {
      uri: env.databaseUrl,
      dateStrings: true,
      decimalNumbers: true,
      ssl,
    };
  }

  return {
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    dateStrings: true,
    decimalNumbers: true,
    ssl,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(values: unknown[]): string {
  return `${values.map(csvCell).join(",")}\n`;
}

export async function streamSalesCsv(
  res: Response,
  filters: SalesFilters,
  limit: number,
): Promise<void> {
  const { whereSql, params } = buildSalesWhere(filters);

  await new Promise<void>((resolve, reject) => {
    const connection = mysql.createConnection(connectionOptions());
    const query = connection.query(
      `
        SELECT
          bill_no,
          outlet_name,
          brand,
          DATE_FORMAT(order_datetime, '%Y-%m-%d %H:%i:%s') AS order_datetime,
          item_group,
          order_type,
          item,
          price,
          quantity,
          settlement,
          line_revenue
        FROM sales_line_items
        ${whereSql}
        ORDER BY order_datetime DESC, bill_no ASC
        LIMIT ?
      `,
      [...params, limit],
    );

    const stream = query.stream({ highWaterMark: 1000 });

    res.write(
      csvLine([
        "BillNo",
        "Outlet_Name",
        "Brand",
        "Order_Datetime",
        "Group",
        "Order_Type",
        "Item",
        "Price",
        "Quantity",
        "Settlement",
        "Line_Revenue",
      ]),
    );

    stream.on("data", (row: ExportRow) => {
      const canContinue = res.write(
        csvLine([
          row.bill_no,
          row.outlet_name,
          row.brand,
          row.order_datetime,
          row.item_group,
          row.order_type,
          row.item,
          row.price,
          row.quantity,
          row.settlement,
          row.line_revenue,
        ]),
      );

      if (!canContinue) {
        stream.pause();
        res.once("drain", () => stream.resume());
      }
    });

    stream.on("error", (error) => {
      connection.destroy();
      reject(error);
    });

    stream.on("end", () => {
      connection.end((error) => {
        if (error) {
          reject(error);
          return;
        }

        res.end();
        resolve();
      });
    });
  });
}
