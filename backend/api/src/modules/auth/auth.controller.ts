import { Request, Response } from "express";
import * as authService from "./auth.service";
import {
  AuthRequest,
} from "../../middleware/auth.middleware";


export async function register(
  req: Request,
  res: Response
) {
  try {
    const email = req.body.email?.trim()?.toLowerCase() || null;
    const phone = req.body.phone?.trim() || null;
    const password = req.body.password;
    const confirmPassword = req.body.confirmPassword;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập email hoặc số điện thoại",
      });
    }

    if (password !== undefined && typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu không hợp lệ",
      });
    }

    if (!password || password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có từ 8 đến 72 ký tự",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu xác nhận không khớp",
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ",
      });
    }

    if (phone && !/^[0-9+]{9,20}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại không hợp lệ",
      });
    }

    const result = await authService.register(
      {
        email,
        phone,
        password,
      },
      req.ip,
      req.get("user-agent") || undefined
    );

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "Email đã tồn tại",
      });
    }

    if (error.message === "PHONE_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "Số điện thoại đã tồn tại",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function login(
  req: Request,
  res: Response
) {
  try {
    // Hỗ trợ cả identifier mới và email cũ để tương thích app hiện tại.
    const identifier = (
      req.body.identifier ||
      req.body.email ||
      req.body.phone ||
      ""
    ).toString().trim();

    const password = req.body.password;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập email/số điện thoại và mật khẩu",
      });
    }

    const deviceId = req.body.deviceId
      ? String(req.body.deviceId).trim()
      : undefined;

    const deviceName = req.body.deviceName
      ? String(req.body.deviceName).trim()
      : undefined;

    const platform = req.body.platform
      ? String(req.body.platform).trim().toLowerCase()
      : undefined;

    const result = await authService.login(
      identifier,
      password,
      req.ip,
      req.get("user-agent") || undefined,
      deviceId,
      deviceName,
      platform
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message === "EMAIL_NOT_VERIFIED") {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Vui lòng xác minh email trước khi đăng nhập",
      });
    }

    if (error.message === "ACCOUNT_TEMPORARILY_LOCKED") {
      return res.status(429).json({
        success: false,
        code: "ACCOUNT_TEMPORARILY_LOCKED",
        message:
          "Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
      });
    }

    if (
      error.message === "INVALID_CREDENTIALS" ||
      error.message === "ACCOUNT_BLOCKED"
    ) {
      return res.status(401).json({
        success: false,
        message: "Thông tin đăng nhập không chính xác hoặc tài khoản bị khóa",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function refresh(
  req: Request,
  res: Response
) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "refreshToken là bắt buộc",
      });
    }

    const result =
      await authService.refreshAccessToken(
        refreshToken,
        req.ip,
        req.get("user-agent") || undefined
      )

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(401).json({
      success: false,
      message: "Refresh token không hợp lệ hoặc đã hết hạn",
    });
  }
}
export async function logout(
  req: Request,
  res: Response
) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "refreshToken là bắt buộc",
      });
    }

    const result =
      await authService.logout(
        refreshToken,
        req.ip,
        req.get("user-agent") || undefined
      )

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không thể đăng xuất",
    });
  }
}

export async function me(
  req: AuthRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const user =
      await authService.getMe(userId);

    return res.status(200).json({
      success: true,
      data: user,
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

export async function changePassword(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "currentPassword và newPassword là bắt buộc",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Mật khẩu mới phải có ít nhất 8 ký tự",
      });
    }

    const result = await authService.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: "Đổi mật khẩu thành công",
    });
  } catch (error: any) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    if (error.message === "CURRENT_PASSWORD_INVALID") {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không chính xác",
      });
    }

    if (error.message === "PASSWORD_SAME") {
      return res.status(400).json({
        success: false,
        message:
          "Mật khẩu mới phải khác mật khẩu hiện tại",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function forgotPassword(
  req: Request,
  res: Response
) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email là bắt buộc",
      });
    }

    const result = await authService.forgotPassword(
      email,
      req.ip,
      req.get("user-agent") || undefined
    );

    return res.status(200).json({
      success: true,
      data: result,
      message:
        "Nếu email tồn tại, mã đặt lại mật khẩu đã được tạo",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function resetPassword(
  req: Request,
  res: Response
) {
  try {
    const {
      userId,
      token,
      newPassword,
    } = req.body;

    if (!userId || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "userId, token và newPassword là bắt buộc",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Mật khẩu mới phải có ít nhất 8 ký tự",
      });
    }

    const result = await authService.resetPassword(
      userId,
      token,
      newPassword
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: "Đặt lại mật khẩu thành công",
    });
  } catch (error: any) {
    const resetErrors = [
      "RESET_TOKEN_NOT_FOUND",
      "RESET_TOKEN_INVALID",
      "RESET_TOKEN_USED",
      "RESET_TOKEN_REVOKED",
      "RESET_TOKEN_EXPIRED",
    ];

    if (resetErrors.includes(error.message)) {
      return res.status(400).json({
        success: false,
        message:
          "Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function verifyEmail(
  req: Request,
  res: Response
) {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        message: "userId và token là bắt buộc",
      });
    }

    const result =
      await authService.verifyEmail(
        userId,
        token
      );

    return res.status(200).json({
      success: true,
      data: result,
      message: "Xác thực email thành công",
    });
  } catch (error: any) {
    const verificationErrors = [
      "VERIFICATION_TOKEN_NOT_FOUND",
      "VERIFICATION_TOKEN_INVALID",
      "VERIFICATION_TOKEN_USED",
      "VERIFICATION_TOKEN_REVOKED",
      "VERIFICATION_TOKEN_EXPIRED",
      "VERIFICATION_TOKEN_ATTEMPTS_EXCEEDED",

    ];

    if (
      error.message === "VERIFICATION_TOKEN_ATTEMPTS_EXCEEDED"
    ) {
      return res.status(400).json({
        success: false,
        code: "VERIFICATION_TOKEN_ATTEMPTS_EXCEEDED",
        message:
          "Bạn đã nhập sai mã xác thực quá 5 lần. Vui lòng yêu cầu mã mới.",
      });
    }

    if (error.message === "ACCOUNT_NOT_PENDING") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_NOT_PENDING",
        message: "Tài khoản không ở trạng thái chờ xác minh",
      });
    }

    if (verificationErrors.includes(error.message)) {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực không hợp lệ hoặc đã hết hạn",
      });
    }
  }
}

export async function resendVerification(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const result = await authService.resendVerification(
      req.user.id,
      req.ip,
      req.get("user-agent") || undefined
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: "Đã tạo mã xác thực mới",
    });
  } catch (error: any) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    if (error.message === "ACCOUNT_BLOCKED") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BLOCKED",
        message: "Tài khoản đã bị khóa",
      });
    }

    if (error.message === "ACCOUNT_NOT_ACTIVE") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_NOT_ACTIVE",
        message: "Tài khoản hiện không hoạt động",
      });
    }

    if (error.message === "OTP_RESEND_TOO_SOON") {
      return res.status(429).json({
        success: false,
        code: "OTP_RESEND_TOO_SOON",
        message: "Vui lòng chờ 60 giây trước khi gửi lại mã",
      });
    }

    if (error.message === "OTP_RESEND_LIMIT_EXCEEDED") {
      return res.status(429).json({
        success: false,
        code: "OTP_RESEND_LIMIT_EXCEEDED",
        message: "Bạn đã gửi tối đa 5 mã trong một giờ. Vui lòng thử lại sau",
      });
    }

    if (error.message === "EMAIL_ALREADY_VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Email đã được xác thực",
      });
    }

    if (error.message === "EMAIL_NOT_AVAILABLE") {
      return res.status(400).json({
        success: false,
        message: "Tài khoản chưa có email để xác minh",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}


export async function resendVerificationWithPassword(
  req: Request,
  res: Response
) {
  try {
    const { identifier, password } = req.body;

    if (
      typeof identifier !== "string" ||
      typeof password !== "string" ||
      !identifier.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập thông tin đăng nhập và mật khẩu",
      });
    }

    const result = await authService.resendVerificationWithPassword(
      identifier,
      password,
      req.ip,
      req.get("user-agent") || undefined
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: "Đã gửi lại mã xác minh",
    });
  } catch (error: any) {
    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        message: "Thông tin đăng nhập không chính xác",
      });
    }

    if (error.message === "ACCOUNT_BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị khóa",
      });
    }

    if (error.message === "EMAIL_ALREADY_VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Email đã được xác minh",
      });
    }

    if (error.message === "EMAIL_NOT_AVAILABLE") {
      return res.status(400).json({
        success: false,
        message: "Tài khoản chưa có email để xác minh",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}


// Lấy danh sách thiết bị đang đăng nhập
export async function getSessions(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const sessions = await authService.getActiveSessions(
      req.user.id,
      req.user.sessionId
    );

    return res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}


// Đăng xuất một thiết bị
export async function revokeSession(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const sessionId = req.params.sessionId;

    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return res.status(400).json({
        success: false,
        message: "sessionId không hợp lệ",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu sessionId",
      });
    }

    const revoked = await authService.revokeSession(
      req.user.id,
      sessionId
    );

    if (!revoked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thiết bị hoặc thiết bị đã đăng xuất",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đã đăng xuất thiết bị",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}


// Đăng xuất tất cả thiết bị khác
export async function revokeOtherSessions(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id || !req.user?.sessionId) {
      return res.status(401).json({
        success: false,
        message: "Không xác định được phiên đăng nhập hiện tại",
      });
    }

    const revokedCount = await authService.revokeOtherSessions(
      req.user.id,
      req.user.sessionId
    );

    return res.status(200).json({
      success: true,
      data: {
        revokedCount,
      },
      message: `Đã đăng xuất ${revokedCount} thiết bị khác`,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

