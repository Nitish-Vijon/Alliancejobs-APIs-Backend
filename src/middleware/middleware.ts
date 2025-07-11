import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ErrorHandler } from "../util/errorHandler";
import { STATUS_CODES } from "../constants/statusCodes";
import { config } from "../lib/config";
// Extend Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string | number;
        email: string;
        userType: string;
      };
    }
  }
}

// JWT Payload interface
interface JWTPayload {
  id: string | number;
  email: string;
  userType: string;
  iat?: number;
  exp?: number;
}

// Basic authentication middleware
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ErrorHandler({
        message: "Access denied",
        error: "No token provided or invalid token format",
        status: STATUS_CODES.UNAUTHORIZED,
        data: null,
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new ErrorHandler({
        message: "Access denied",
        error: "Token is required",
        status: STATUS_CODES.UNAUTHORIZED,
        data: null,
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      config.access_key as string
    ) as JWTPayload;

    // Add user info to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      userType: decoded.userType,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ErrorHandler({
        message: "Access denied",
        error: "Invalid token",
        status: STATUS_CODES.UNAUTHORIZED,
        data: null,
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new ErrorHandler({
        message: "Access denied",
        error: "Token has expired",
        status: STATUS_CODES.UNAUTHORIZED,
        data: null,
      });
    } else {
      next(error);
    }
  }
};
