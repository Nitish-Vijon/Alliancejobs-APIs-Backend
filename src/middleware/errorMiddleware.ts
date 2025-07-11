import { Request, Response, NextFunction } from "express";
import { STATUS_CODES } from "../constants/statusCodes";

interface CustomError extends Error {
  status?: number;
  message: string;
  error?: string;
  data?: any;
  timestamp?: string;
}

export const errorMiddleware = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set default values
  const status = err.status || STATUS_CODES.SERVER_ERROR;
  const message = err.message || "Something went wrong";
  const error = err.error || message;
  const data = err.data || {};
  const timestamp = err.timestamp || new Date().toISOString();

  // Send error response
  res.status(status).json({
    success: false,
    error,
    message,
    data,
    timestamp,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
