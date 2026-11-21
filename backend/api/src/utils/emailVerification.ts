
import crypto from "crypto";

export function generateEmailVerificationToken(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashEmailVerificationToken(
  token: string
): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}
