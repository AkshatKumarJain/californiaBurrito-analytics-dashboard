import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

interface DatabaseError {
  code?: string;
  sqlMessage?: string;
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Invalid request parameters.",
      issues: error.issues,
    });
    return;
  }

  const databaseError = error as DatabaseError;
  if (databaseError.code === "ER_NO_SUCH_TABLE") {
    res.status(500).json({
      message: "A required database table is missing. Run `npm run migrate` in the Backend folder, then retry.",
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    message: "Something went wrong while processing the analytics request.",
  });
};
