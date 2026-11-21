import { Response, NextFunction } from "express";
import pool from "../database/postgres";
import {
  AuthRequest,
  requireAuth,
} from "./auth.middleware";

export interface AdminRequest extends AuthRequest {
  admin?: {
    id: string;
    userId: string;
    roles: string[];
  };
}

export function requireAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
) {
  requireAuth(req, res, async () => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Chưa xác thực tài khoản",
        });
      }

      const result = await pool.query(
        `
        SELECT
          au.id AS admin_id,
          au.user_id,
          COALESCE(
            array_agg(r.code) FILTER (WHERE r.code IS NOT NULL),
            ARRAY[]::text[]
          ) AS roles
        FROM admin.admin_users au
        LEFT JOIN admin.admin_user_roles aur
          ON aur.admin_user_id = au.id
        LEFT JOIN admin.roles r
          ON r.id = aur.role_id
        WHERE au.user_id = $1
          AND au.status = 'active'
        GROUP BY au.id, au.user_id
        LIMIT 1
        `,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Tài khoản không có quyền quản trị hoặc đã bị khóa",
        });
      }

      const admin = result.rows[0];

      req.admin = {
        id: admin.admin_id,
        userId: admin.user_id,
        roles: admin.roles ?? [],
      };

      return next();
    } catch (error) {
      console.error("Lỗi xác thực quản trị:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi xác thực quản trị",
      });
    }
  });
}

export function requirePermission(...permissions: string[]) {
  return async (
    req: AdminRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.admin?.id) {
        return res.status(403).json({
          success: false,
          message: "Chưa xác thực tài khoản quản trị",
        });
      }

      if (permissions.length === 0) {
        return res.status(500).json({
          success: false,
          message: "Chưa cấu hình quyền cần kiểm tra",
        });
      }

      const result = await pool.query(
        `
        SELECT EXISTS (
          SELECT 1
          FROM admin.admin_user_roles aur
          JOIN admin.role_permissions rp
            ON rp.role_id = aur.role_id
          JOIN admin.permissions p
            ON p.id = rp.permission_id
          WHERE aur.admin_user_id = $1
            AND p.code = ANY($2::text[])
        ) AS allowed
        `,
        [req.admin.id, permissions]
      );

      if (!result.rows[0]?.allowed) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền thực hiện thao tác này",
          requiredPermissions: permissions,
        });
      }

      return next();
    } catch (error) {
      console.error("Lỗi kiểm tra quyền quản trị:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi kiểm tra quyền",
      });
    }
  };
}
