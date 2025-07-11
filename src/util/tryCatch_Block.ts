import { Request, Response, NextFunction, RequestHandler } from "express";
import { ErrorHandler } from "./errorHandler";
import { STATUS_CODES } from "../constants/statusCodes";

export const tryCatch = (
  task: string,
  passedFunction: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void>
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await passedFunction(req, res, next);
    } catch (err: any) {
      console.error(`Error in ==> ${task}:`, {
        error: err.message,
        url: req.url,
        method: req.method,
        timestamp: new Date().toDateString(),
      });

      // Handle different error types
      if (err instanceof ErrorHandler) {
        // If it's already an ErrorHandler, pass it along
        next(err);
      } else {
        // Create new ErrorHandler for unexpected errors
        next(
          new ErrorHandler({
            error: err.message || "Unexpected error occurred",
            message: `Error while ${task}`,
            status: err.status || STATUS_CODES.SERVER_ERROR,
            data: {
              task,
              originalError: err.name,
            },
          })
        );
      }
    }
  };
};
