import { Request, Response, NextFunction, Errback } from "express";
import multer from "multer";
import path from "path";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from "../constants/statusCodes";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage: storage,
  limits: {
    files: 3,
    fileSize: 5 * 1024 * 1024,
  },
});

export const handleFileUploadErrors = (
  err: Errback,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading.
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: "Maximum 3 images are allowed",
        status: false,
      });
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Each image must be less than 5MB",
        status: false,
      });
    }
  } else if (err instanceof Error) {
    // An unknown error occurred when uploading.
    return res.status(400).json({
      message: err.message || "Error uploading files",
      status: false,
    });
  }
  next();
};

export const validateFileType = (file: any): boolean => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);
  const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.mimetype);

  return isValidExtension && isValidMimeType;
};
