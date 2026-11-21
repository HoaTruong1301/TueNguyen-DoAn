import { Router } from "express";
import * as authService from "./auth.service";
import {
  register,
  login,
  refresh,
  logout,
  me,
  verifyEmail,
  resendVerification,
  changePassword,
  forgotPassword,
  resetPassword,
  resendVerificationWithPassword,
  getSessions,
  revokeSession,
  revokeOtherSessions,
} from "./auth.controller";

import {
  AuthRequest,
  requireAuth,
} from "../../middleware/auth.middleware";

import {
  authLoginLimiter,
  authRegisterLimiter,
  authOtpLimiter,
} from "../../middleware/auth-rate-limit.middleware";

const router = Router();

router.post("/register", authRegisterLimiter, register);

router.post("/login", authLoginLimiter, login);

router.post(
  "/resend-verification-with-password",
  authOtpLimiter,
  resendVerificationWithPassword
);

router.post("/refresh", refresh);

router.post(
  "/resend-verification",
  requireAuth,
  authOtpLimiter,
  resendVerification
);

router.post(
  "/verify-email",
  authOtpLimiter,
  verifyEmail
);
router.post("/logout", logout);

router.get(
  "/me",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await authService.getCurrentUser(
        req.user.id
      );

      return res.status(200).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error: any) {
      if (error.message === "USER_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy người dùng",
        });
      }

      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server",
      });
    }
  }
);

router.post(
  "/change-password",
  requireAuth,
  changePassword
);

router.post(
  "/forgot-password",
  forgotPassword
);

router.post(
  "/reset-password",
  resetPassword
);

// Quản lý thiết bị đăng nhập
router.get(
  "/sessions",
  requireAuth,
  getSessions
);

router.delete(
  "/sessions/:sessionId",
  requireAuth,
  revokeSession
);

router.post(
  "/sessions/logout-others",
  requireAuth,
  revokeOtherSessions
);

export default router;