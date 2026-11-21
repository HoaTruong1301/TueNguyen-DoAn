import jwt, {
  JwtPayload,
  SignOptions,
} from "jsonwebtoken";

// =========================================================
// JWT SECRETS
// =========================================================

const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

if (!accessSecret) {
  throw new Error("JWT_ACCESS_SECRET chưa được cấu hình");
}

if (!refreshSecret) {
  throw new Error("JWT_REFRESH_SECRET chưa được cấu hình");
}

// Sau các kiểm tra trên, TypeScript vẫn có thể giữ kiểu
// string | undefined, nên tạo biến chắc chắn là string.
const ACCESS_SECRET: string = accessSecret;
const REFRESH_SECRET: string = refreshSecret;

// =========================================================
// PAYLOAD
// =========================================================

export interface AccessTokenPayload extends JwtPayload {
  userId: string;
  sessionId?: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: string;
  tokenFamilyId: string;
}

// =========================================================
// GENERATE ACCESS TOKEN
// =========================================================

export function generateAccessToken(
  userId: string,
  sessionId?: string
): string {
  const payload = {
    userId,
    ...(sessionId ? { sessionId } : {}),
  };

  const options: SignOptions = {
    expiresIn: 15 * 60,
  };

  return jwt.sign(
    payload,
    ACCESS_SECRET,
    options
  );
}

// =========================================================
// GENERATE REFRESH TOKEN
// =========================================================

export function generateRefreshToken(
  userId: string,
  tokenFamilyId: string
): string {
  const payload = {
    userId,
    tokenFamilyId,
  };

  const options: SignOptions = {
    expiresIn: 30 * 24 * 60 * 60,
  };

  return jwt.sign(
    payload,
    REFRESH_SECRET,
    options
  );
}

// =========================================================
// VERIFY ACCESS TOKEN
// =========================================================

export function verifyAccessToken(
  token: string
): AccessTokenPayload {
  const decoded = jwt.verify(
    token,
    ACCESS_SECRET
  );

  if (
    typeof decoded === "string" ||
    !decoded.userId ||
    typeof decoded.userId !== "string"
  ) {
    throw new Error("Access token không hợp lệ");
  }

  return decoded as unknown as AccessTokenPayload;
}

// =========================================================
// VERIFY REFRESH TOKEN
// =========================================================

export function verifyRefreshToken(
  token: string
): RefreshTokenPayload {
  const decoded = jwt.verify(
    token,
    REFRESH_SECRET
  );

  if (
    typeof decoded === "string" ||
    !decoded.userId ||
    typeof decoded.userId !== "string" ||
    !decoded.tokenFamilyId ||
    typeof decoded.tokenFamilyId !== "string"
  ) {
    throw new Error("Refresh token không hợp lệ");
  }

  return decoded as unknown as RefreshTokenPayload;
}