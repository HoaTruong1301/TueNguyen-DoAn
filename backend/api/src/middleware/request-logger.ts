import { Request, Response, NextFunction } from "express";
import pool from "../database/postgres";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - startTime;

    const requestId = res.locals.requestId;

    const userId = res.locals.userId ?? null;

    void pool
      .query(
        `
        INSERT INTO system.api_request_logs (
          request_id,
          user_id,
          method,
          endpoint,
          status_code,
          response_time_ms,
          ip_address,
          user_agent
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
        `,
        [
          requestId,
          userId,
          req.method,
          req.originalUrl,
          res.statusCode,
          responseTime,
          req.ip || null,
          req.get("user-agent") || null
        ]
      )
      .catch((error) => {
        console.error(
          "Failed to save API request log:",
          error
        );
      });
  });

  next();
}