import rateLimit from "express-rate-limit";

export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  handler: (req, res) => {
    console.log("[AUTH RATE LIMIT] LOGIN BLOCKED:", req.ip);

    res.status(429).json({
      success: false,
      code: "TOO_MANY_LOGIN_ATTEMPTS",
      message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.",
    });
  },

  message: {
    success: false,
    code: "TOO_MANY_LOGIN_ATTEMPTS",
    message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  },
});
export const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    code: "TOO_MANY_REGISTRATION_ATTEMPTS",
    message: "Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau.",
  },
});

export const authOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    code: "TOO_MANY_OTP_ATTEMPTS",
    message: "Bạn đã gửi quá nhiều yêu cầu xác minh. Vui lòng thử lại sau.",
  },
});
