
import { Request, Response, NextFunction } from "express";
import pool from "../database/postgres";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    sessionId?: string;
  };
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: "Thiếu Authorization",
      });
    }

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization không hợp lệ",
      });
    }

    const token = authorization.substring(7);
    const payload = verifyAccessToken(token);

    if (!payload.sessionId) {
      return res.status(401).json({
        success: false,
        code: "SESSION_ID_MISSING",
        message: "Token không có thông tin phiên đăng nhập",
      });
    }

    const sessionResult = await pool.query(
      `
      SELECT id
      FROM auth.user_sessions
      WHERE id = $1
        AND user_id = $2
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
      `,
      [payload.sessionId, payload.userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        code: "SESSION_INVALID",
        message: "Phiên đăng nhập đã hết hạn hoặc bị thu hồi",
      });
    }

    const userResult = await pool.query(
      `
      SELECT status
      FROM auth.users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "Tài khoản không tồn tại hoặc đã bị xóa",
      });
    }

    const userStatus = userResult.rows[0].status;

    if (userStatus !== "active") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_NOT_ACTIVE",
        message: "Tài khoản không hoạt động",
      });
    }

    req.user = {
      id: payload.userId,
      sessionId: payload.sessionId,
    };

    return next();
  } catch (error) {
    console.error(
      "Lỗi xác thực access token:",
      error instanceof Error ? error.name : "UnknownError",
      error instanceof Error ? error.message : ""
    );

    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
}
