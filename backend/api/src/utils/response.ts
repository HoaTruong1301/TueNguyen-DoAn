import { Response } from "express";

export function successResponse(
  res: Response,
  data: unknown,
  statusCode = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    requestId: res.locals.requestId
  });
}

export function errorResponse(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown
): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {})
    },
    requestId: res.locals.requestId
  });
}