export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
} as const;

export type StatusCodes = (typeof STATUS_CODES)[keyof typeof STATUS_CODES];

export const getStatusMessage = (code: StatusCodes): string => {
  switch (code) {
    case STATUS_CODES.OK:
      return "OK";
    case STATUS_CODES.CREATED:
      return "Created";
    case STATUS_CODES.ACCEPTED:
      return "Accepted";
    case STATUS_CODES.NO_CONTENT:
      return "No Content";
    case STATUS_CODES.BAD_REQUEST:
      return "Bad Request";
    case STATUS_CODES.UNAUTHORIZED:
      return "Unauthorized";
    case STATUS_CODES.FORBIDDEN:
      return "Forbidden";
    case STATUS_CODES.NOT_FOUND:
      return "Not Found";
    case STATUS_CODES.CONFLICT:
      return "Conflict";
    case STATUS_CODES.SERVER_ERROR:
      return "Internal Server Error";
    default:
      return "Unknown Status Code";
  }
};
