import { STATUS_CODES } from "../constants/statusCodes.js";

interface ErrorHandlerOptions {
  message: string; // task description
  error?: string; // actual error message (optional)
  status?: number; // HTTP status code
  data?: any; // additional data (context, meta info, etc.)
}

export class ErrorHandler extends Error {
  public status: number;
  public message: string;
  public error: string;
  public data: any;
  public timestamp: string;

  constructor({
    message,
    error,
    status = STATUS_CODES.SERVER_ERROR, // Default to 500 if not provided
    data = {},
  }: ErrorHandlerOptions) {
    super(message);
    this.name = "ErrorHandler";
    this.status = status;
    this.message = message;
    this.error = error || message;
    this.data = data;
    this.timestamp = new Date().toDateString();

    // Maintains proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Optional: capture stack trace (Node.js specific)
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Optional: Convert to JSON for logging or API responses
  toJSON() {
    return {
      status: this.status,
      message: this.message,
      error: this.error,
      data: this.data,
      timestamp: this.timestamp,
    };
  }
}
