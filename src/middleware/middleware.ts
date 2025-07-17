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
    let token: string | undefined;

    // Try to get token from Authorization header (with or without Bearer)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      } else {
        // Token sent directly in Authorization header without Bearer prefix
        token = authHeader;
      }
    }

    // If no token found in Authorization header, try custom headers
    if (!token) {
      // Try common custom header names
      token =
        (req.headers["x-auth-token"] as string) ||
        (req.headers["x-access-token"] as string) ||
        (req.headers["token"] as string);
    }

    // If still no token, check query parameters as fallback
    if (!token) {
      token = req.query.token as string;
    }

    if (!token) {
      throw new ErrorHandler({
        message: "Access denied",
        error:
          "No token provided. Please provide token in Authorization header, custom header (x-auth-token, x-access-token, token), or query parameter",
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
