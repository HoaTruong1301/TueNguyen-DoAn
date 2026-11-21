import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export function requestId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingRequestId = req.header("X-Request-ID");
  const id = incomingRequestId || randomUUID();

  res.setHeader("X-Request-ID", id);

  res.locals.requestId = id;

  next();
}