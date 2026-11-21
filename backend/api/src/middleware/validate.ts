import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

export function validateBody(schema: ZodType) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(422).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu gửi lên không hợp lệ.",
          details: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message
          }))
        },
        requestId: res.locals.requestId
      });

      return;
    }

    req.body = result.data;

    next();
  };
}