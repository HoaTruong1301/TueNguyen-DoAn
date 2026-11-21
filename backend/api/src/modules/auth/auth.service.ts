import pool from "../../database/postgres";
import { sendVerificationEmail } from "../email/email.service";
import crypto from "crypto";
import {
  hashPassword,
  comparePassword,
} from "../../utils/password";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";

import {
  hashToken,
  generateTokenFamilyId,
} from "../../utils/token";

import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from "../../utils/emailVerification";

import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "../../utils/passwordReset";



export async function register(
  data: {
    email: string | null;
    phone: string | null;
    password: string;
  },
  ip?: string,
  userAgent?: string
) {
  const client = await pool.connect();

  let user: any;

  try {
    await client.query("BEGIN");

    const email = data.email?.trim().toLowerCase() || null;
    const phone = data.phone?.trim() || null;

    if (!email && !phone) {
      throw new Error("EMAIL_OR_PHONE_REQUIRED");
    }

    if (email) {
      const existingEmail = await client.query(
        `
        SELECT id
        FROM auth.users
        WHERE LOWER(email) = LOWER($1)
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [email]
      );

      if (existingEmail.rows.length > 0) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }
    }

    if (phone) {
      const existingPhone = await client.query(
        `
        SELECT id
        FROM auth.users
        WHERE phone = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [phone]
      );

      if (existingPhone.rows.length > 0) {
        throw new Error("PHONE_ALREADY_EXISTS");
      }
    }

    const passwordHash = await hashPassword(data.password);

    const result = await client.query(
      `
      INSERT INTO auth.users (
        email,
        phone,
        password_hash,
        status
      )
      VALUES ($1, $2, $3, 'pending')
      RETURNING
        id,
        email,
        phone,
        status,
        created_at
      `,
      [email, phone, passwordHash]
    );

    user = result.rows[0];


    // Đồng bộ các lần đăng nhập của cùng một tài khoản
    // Khóa tự động được giải phóng khi COMMIT hoặc ROLLBACK
    await client.query(
      `
      SELECT pg_advisory_xact_lock(
        hashtextextended($1::text, 0)
      )
      `,
      [user.id]
    );


    
    const tokenFamilyId = generateTokenFamilyId();

    const refreshToken = generateRefreshToken(
      user.id,
      tokenFamilyId
    );

    const refreshTokenHash = hashToken(refreshToken);

    // Tạo phiên đăng nhập đầu tiên cho tài khoản mới
    const sessionResult = await client.query(
      `
      INSERT INTO auth.user_sessions (
        user_id,
        refresh_token_hash,
        ip_address,
        user_agent,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        NOW() + INTERVAL '30 days'
      )
      RETURNING id
      `,
      [
        user.id,
        refreshTokenHash,
        ip || null,
        userAgent || null,
      ]
    );

    const sessionId = sessionResult.rows[0].id;
    const accessToken = generateAccessToken(
      user.id,
      sessionId
    );

    // Lưu refresh token và liên kết với phiên
    await client.query(
      `
      INSERT INTO auth.refresh_tokens (
        user_id,
        session_id,
        token_hash,
        token_family_id,
        expires_at,
        created_ip,
        created_user_agent
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        NOW() + INTERVAL '30 days',
        $5,
        $6
      )
      `,
      [
        user.id,
        sessionId,
        refreshTokenHash,
        tokenFamilyId,
        ip || null,
        userAgent || null,
      ]
    );

    // Ghi nhận sự kiện tạo tài khoản
    await client.query(
      `
      INSERT INTO auth.session_events (
        session_id,
        user_id,
        event_type,
        ip_address,
        user_agent,
        metadata
      )
      VALUES (
        $1,
        $2,
        'register',
        $3,
        $4,
        $5::jsonb
      )
      `,
      [
        sessionId,
        user.id,
        ip || null,
        userAgent || null,
        JSON.stringify({
          method: email && phone
            ? "email_and_phone"
            : email
              ? "email"
              : "phone",
        }),
      ]
    );

    await client.query("COMMIT");

    let emailSent = false;

    if (email) {
      try {
        const verificationToken =
          await createEmailVerificationToken(
            user.id,
            ip,
            userAgent
          );

        await sendVerificationEmail(
          email,
          verificationToken
        );

        emailSent = true;
      } catch (error) {
        console.error(
          "SEND_VERIFICATION_EMAIL_FAILED:",
          error
        );
      }
    }

    return {
      user,
      accessToken,
      refreshToken,
      emailSent,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}






export async function login(
  identifier: string,
  password: string,
  ip?: string,
  userAgent?: string,
  deviceId?: string,
  deviceName?: string,
  platform?: string
) {
  const normalizedIdentifier = identifier.trim();
  const isEmail = normalizedIdentifier.includes("@");

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Hàm ghi nhận lịch sử đăng nhập
    const recordLoginAttempt = async (
      userId: string | null,
      success: boolean,
      failureReason: string | null = null
    ) => {
      await client.query(
        `
        INSERT INTO auth.login_attempts (
          user_id,
          identifier,
          success,
          ip_address,
          user_agent,
          failure_reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          userId,
          normalizedIdentifier,
          success,
          ip || null,
          userAgent || null,
          failureReason,
        ]
      );
    };

    // Khóa bản ghi tài khoản để tránh đăng nhập đồng thời vượt giới hạn
    const result = await client.query(
      `
      SELECT
        id,
        email,
        phone,
        password_hash,
        status,
        email_verified_at,
        failed_login_attempts,
        locked_until
      FROM auth.users
      WHERE
        (
          (
            $2 = TRUE
            AND LOWER(email) = LOWER($1)
          )
          OR
          (
            $2 = FALSE
            AND phone = $1
          )
        )
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [normalizedIdentifier, isEmail]
    );

    // Không tìm thấy tài khoản
    if (result.rows.length === 0) {
      await recordLoginAttempt(
        null,
        false,
        "INVALID_CREDENTIALS"
      );

      await client.query("COMMIT");
      transactionStarted = false;

      throw new Error("INVALID_CREDENTIALS");
    }

    const user = result.rows[0];

    // Kiểm tra thời gian khóa
    if (
      user.locked_until &&
      new Date(user.locked_until).getTime() > Date.now()
    ) {
      await recordLoginAttempt(
        user.id,
        false,
        "ACCOUNT_TEMPORARILY_LOCKED"
      );

      await client.query("COMMIT");
      transactionStarted = false;

      throw new Error("ACCOUNT_TEMPORARILY_LOCKED");
    }

    // Kiểm tra tài khoản bị chặn
    // Kiểm tra trạng thái tài khoản
    if (user.status !== "active") {
      const errorCode =
        user.status === "blocked"
          ? "ACCOUNT_BLOCKED"
          : "ACCOUNT_NOT_ACTIVE";

      await recordLoginAttempt(
        user.id,
        false,
        errorCode
      );

      await client.query("COMMIT");
      transactionStarted = false;

      throw new Error(errorCode);
    }

    const passwordValid = await comparePassword(
      password,
      user.password_hash
    );

    // Mật khẩu sai: tăng bộ đếm
    if (!passwordValid) {
      const updateResult = await client.query(
        `
        UPDATE auth.users
        SET
          failed_login_attempts = CASE
            WHEN locked_until IS NOT NULL
              AND locked_until <= NOW()
            THEN 1
            ELSE failed_login_attempts + 1
          END,
          locked_until = CASE
            WHEN (
              CASE
                WHEN locked_until IS NOT NULL
                  AND locked_until <= NOW()
                THEN 1
                ELSE failed_login_attempts + 1
              END
            ) >= 5
            THEN NOW() + INTERVAL '15 minutes'
            ELSE NULL
          END
        WHERE id = $1
        RETURNING failed_login_attempts
        `,
        [user.id]
      );

      const attempts =
        updateResult.rows[0].failed_login_attempts;

      const failureReason =
        attempts >= 5
          ? "ACCOUNT_TEMPORARILY_LOCKED"
          : "INVALID_CREDENTIALS";

      await recordLoginAttempt(
        user.id,
        false,
        failureReason
      );

      await client.query("COMMIT");
      transactionStarted = false;

      if (attempts >= 5) {
        throw new Error("ACCOUNT_TEMPORARILY_LOCKED");
      }

      throw new Error("INVALID_CREDENTIALS");
    }

    // Mật khẩu đúng: đặt lại bộ đếm
    await client.query(
      `
      UPDATE auth.users
      SET
        failed_login_attempts = 0,
        locked_until = NULL
      WHERE id = $1
      `,
      [user.id]
    );

    // Kiểm tra quyền admin
    const adminCheck = await client.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM admin.admin_users
        WHERE user_id = $1
          AND status = 'active'
      ) AS is_active_admin
      `,
      [user.id]
    );

    const isActiveAdmin =
      adminCheck.rows[0]?.is_active_admin === true;

    // Kiểm tra xác minh email
    if (
      user.email &&
      !user.email_verified_at &&
      !isActiveAdmin
    ) {
      await recordLoginAttempt(
        user.id,
        false,
        "EMAIL_NOT_VERIFIED"
      );

      await client.query("COMMIT");
      transactionStarted = false;

      throw new Error("EMAIL_NOT_VERIFIED");
    }

    // Tạo token
    const tokenFamilyId = generateTokenFamilyId();

    const refreshToken = generateRefreshToken(
      user.id,
      tokenFamilyId
    );

    const refreshTokenHash = hashToken(refreshToken);

    // Thời hạn phiên đăng nhập: 30 ngày
    
    const sessionResult = await client.query(
      `
      INSERT INTO auth.user_sessions (
        user_id,
        refresh_token_hash,
        device_id,
        device_name,
        platform,
        ip_address,
        user_agent,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        NOW() + INTERVAL '30 days'
      )
      RETURNING id
      `,
      [
        user.id,
        refreshTokenHash,
        deviceId || null,
        deviceName || null,
        platform || null,
        ip || null,
        userAgent || null,
      ]
    );

    const sessionId = sessionResult.rows[0].id;

    const accessToken = generateAccessToken(
      user.id,
      sessionId
    );


    // Cập nhật thời gian đăng nhập gần nhất
    await client.query(
      `
      UPDATE auth.users
      SET last_login_at = NOW()
      WHERE id = $1
      `,
      [user.id]
    );

    // Lưu refresh token và liên kết với phiên đăng nhập
    await client.query(
      `
      INSERT INTO auth.refresh_tokens (
        user_id,
        session_id,
        token_hash,
        token_family_id,
        expires_at,
        created_ip,
        created_user_agent
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        NOW() + INTERVAL '30 days',
        $5,
        $6
      )
      `,
      [
        user.id,
        sessionId,
        refreshTokenHash,
        tokenFamilyId,
        ip || null,
        userAgent || null,
      ]
    );

    // Ghi nhận đăng nhập thành công
    await recordLoginAttempt(
      user.id,
      true,
      null
    );

    // Ghi nhận sự kiện phiên đăng nhập
    await client.query(
      `
      INSERT INTO auth.session_events (
        session_id,
        user_id,
        event_type,
        ip_address,
        user_agent,
        metadata
      )
      VALUES (
        $1,
        $2,
        'login',
        $3,
        $4,
        $5::jsonb
      )
      `,
      [
        sessionId,
        user.id,
        ip || null,
        userAgent || null,
        JSON.stringify({
          method: isEmail ? "email" : "phone",
          deviceId: deviceId || null,
          deviceName: deviceName || null,
          platform: platform || null,
        }),
      ]
    );


    // Giới hạn tối đa 4 phiên đăng nhập đang hoạt động
    const activeSessions = await client.query(
      `
      SELECT id
      FROM auth.user_sessions
      WHERE user_id = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
      `,
      [user.id]
    );

    const excessCount = activeSessions.rows.length - 4;

    if (excessCount > 0) {
      const sessionsToRevoke = activeSessions.rows.slice(
        0,
        excessCount
      );

      for (const session of sessionsToRevoke) {
        // Thu hồi phiên đăng nhập
        await client.query(
          `
          UPDATE auth.user_sessions
          SET revoked_at = NOW()
          WHERE id = $1
            AND user_id = $2
            AND revoked_at IS NULL
          `,
          [session.id, user.id]
        );

        // Thu hồi tất cả refresh token thuộc phiên
        await client.query(
          `
          UPDATE auth.refresh_tokens
          SET
            revoked_at = NOW(),
            revoke_reason = 'session_limit_exceeded'
          WHERE session_id = $1
            AND user_id = $2
            AND revoked_at IS NULL
          `,
          [session.id, user.id]
        );

        // Ghi lịch sử thu hồi phiên
        await client.query(
          `
          INSERT INTO auth.session_events (
            session_id,
            user_id,
            event_type,
            ip_address,
            user_agent,
            metadata
          )
          VALUES ($1, $2, 'session_revoked', $3, $4, $5)
          `,
          [
            session.id,
            user.id,
            ip || null,
            userAgent || null,
            JSON.stringify({
              reason: "session_limit_exceeded",
              maxActiveSessions: 4,
            }),
          ]
        );
      }
    }


    await client.query("COMMIT");
    transactionStarted = false;

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
  }
}




export async function refreshAccessToken(
  refreshToken: string,
  ip?: string,
  userAgent?: string
) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Tìm và khóa refresh token hiện tại
    const result = await client.query(
      `
      SELECT
        id,
        user_id,
        session_id,
        token_family_id,
        expires_at,
        used_at,
        revoked_at
      FROM auth.refresh_tokens
      WHERE token_hash = $1
      LIMIT 1
      FOR UPDATE
      `,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw new Error("REFRESH_TOKEN_NOT_FOUND");
    }

    const storedToken = result.rows[0];
    // Kiểm tra trạng thái tài khoản trước khi cấp token mới
    const userResult = await client.query(
      `
      SELECT
        id,
        status,
        deleted_at
      FROM auth.users
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
      `,
      [storedToken.user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    const refreshUser = userResult.rows[0];

    if (refreshUser.deleted_at) {
      throw new Error("ACCOUNT_DELETED");
    }

    if (refreshUser.status === "blocked") {
      throw new Error("ACCOUNT_BLOCKED");
    }

    if (refreshUser.status !== "active") {
      throw new Error("ACCOUNT_NOT_ACTIVE");
    }

        
    if (storedToken.revoked_at) {
      throw new Error("REFRESH_TOKEN_REVOKED");
    }

    // Phát hiện refresh token đã sử dụng bị gửi lại
    if (storedToken.used_at) {
      // Thu hồi toàn bộ refresh token trong cùng family
      await client.query(
        `
        UPDATE auth.refresh_tokens
        SET
          revoked_at = NOW(),
          revoke_reason = 'refresh_token_reuse'
        WHERE token_family_id = $1
          AND user_id = $2
          AND revoked_at IS NULL
        `,
        [
          storedToken.token_family_id,
          storedToken.user_id,
        ]
      );

      // Thu hồi phiên đăng nhập liên quan
      if (storedToken.session_id) {
        await client.query(
          `
          UPDATE auth.user_sessions
          SET revoked_at = NOW()
          WHERE id = $1
            AND user_id = $2
            AND revoked_at IS NULL
          `,
          [
            storedToken.session_id,
            storedToken.user_id,
          ]
        );

        // Ghi nhận sự kiện bảo mật
        await client.query(
          `
          INSERT INTO auth.session_events (
            session_id,
            user_id,
            event_type,
            ip_address,
            user_agent,
            metadata
          )
          VALUES (
            $1,
            $2,
            'refresh_token_reuse_detected',
            $3,
            $4,
            $5::jsonb
          )
          `,
          [
            storedToken.session_id,
            storedToken.user_id,
            ip || null,
            userAgent || null,
            JSON.stringify({
              reason: "refresh_token_reuse",
              token_family_id: storedToken.token_family_id,
            }),
          ]
        );
      }

      // Phải COMMIT trước khi báo lỗi để lưu việc thu hồi token
      await client.query("COMMIT");
      transactionStarted = false;

      throw new Error("REFRESH_TOKEN_REUSE_DETECTED");
    }


    if (
      new Date(storedToken.expires_at).getTime() <=
      Date.now()
    ) {
      throw new Error("REFRESH_TOKEN_EXPIRED");
    }

    if (
      String(storedToken.user_id) !==
      String(payload.userId)
    ) {
      throw new Error("REFRESH_TOKEN_INVALID");
    }

    if (
      String(storedToken.token_family_id) !==
      String(payload.tokenFamilyId)
    ) {
      throw new Error("REFRESH_TOKEN_INVALID");
    }

    // Kiểm tra phiên đối với token được tạo theo cơ chế mới
    let sessionId: string | null =
      storedToken.session_id || null;

    if (sessionId) {
      const sessionResult = await client.query(
        `
        SELECT
          id,
          user_id,
          refresh_token_hash,
          expires_at,
          revoked_at
        FROM auth.user_sessions
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error("SESSION_NOT_FOUND");
      }

      const session = sessionResult.rows[0];

      if (
        String(session.user_id) !==
        String(storedToken.user_id)
      ) {
        throw new Error("SESSION_INVALID");
      }

      if (session.revoked_at) {
        throw new Error("SESSION_REVOKED");
      }

      if (
        new Date(session.expires_at).getTime() <=
        Date.now()
      ) {
        throw new Error("SESSION_EXPIRED");
      }

      // Chỉ token mới nhất của phiên mới được phép refresh
      if (
        session.refresh_token_hash !== tokenHash
      ) {
        throw new Error("SESSION_INVALID");
      }
    }

    // Tạo token mới
    const newRefreshToken = generateRefreshToken(
      payload.userId,
      storedToken.token_family_id
    );

    const newAccessToken = generateAccessToken(
      payload.userId,
      sessionId || undefined
    );

    const newRefreshTokenHash =
      hashToken(newRefreshToken);

    // Đánh dấu token cũ đã được sử dụng
    const updateResult = await client.query(
      `
      UPDATE auth.refresh_tokens
      SET
        used_at = NOW(),
        last_used_ip = $2,
        last_used_user_agent = $3
      WHERE id = $1
        AND used_at IS NULL
        AND revoked_at IS NULL
      RETURNING id
      `,
      [
        storedToken.id,
        ip || null,
        userAgent || null,
      ]
    );

    if (updateResult.rowCount !== 1) {
      throw new Error("REFRESH_TOKEN_ALREADY_USED");
    }

    // Tạo refresh token kế tiếp, giữ nguyên session_id
    await client.query(
      `
      INSERT INTO auth.refresh_tokens (
        user_id,
        session_id,
        token_hash,
        token_family_id,
        parent_token_id,
        expires_at,
        created_ip,
        created_user_agent
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        NOW() + INTERVAL '30 days',
        $6,
        $7
      )
      `,
      [
        payload.userId,
        sessionId,
        newRefreshTokenHash,
        storedToken.token_family_id,
        storedToken.id,
        ip || null,
        userAgent || null,
      ]
    );

    // Cập nhật thông tin phiên nếu là token mới
    if (sessionId) {
      const updatedSession = await client.query(
        `
        UPDATE auth.user_sessions
        SET
          refresh_token_hash = $2,
          expires_at = NOW() + INTERVAL '30 days',
          ip_address = COALESCE($3, ip_address),
          user_agent = COALESCE($4, user_agent)
        WHERE id = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
          AND refresh_token_hash = $5
        RETURNING id
        `,
        [
          sessionId,
          newRefreshTokenHash,
          ip || null,
          userAgent || null,
          tokenHash,
        ]
      );

      if (updatedSession.rowCount !== 1) {
        throw new Error("SESSION_INVALID");
      }

      // Ghi nhận sự kiện refresh
      await client.query(
        `
        INSERT INTO auth.session_events (
          session_id,
          user_id,
          event_type,
          ip_address,
          user_agent,
          metadata
        )
        VALUES (
          $1,
          $2,
          'token_refreshed',
          $3,
          $4,
          $5::jsonb
        )
        `,
        [
          sessionId,
          payload.userId,
          ip || null,
          userAgent || null,
          JSON.stringify({
            refresh_token_rotated: true,
          }),
        ]
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Giữ nguyên lỗi ban đầu.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}




export async function logout(
  refreshToken: string,
  ip?: string,
  userAgent?: string
) {
  const tokenHash = hashToken(refreshToken);

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Tìm refresh token
    const result = await client.query(
      `
      SELECT
        id,
        user_id,
        session_id,
        used_at,
        revoked_at
      FROM auth.refresh_tokens
      WHERE token_hash = $1
      LIMIT 1
      FOR UPDATE
      `,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      await client.query("COMMIT");
      transactionStarted = false;

      return { success: false };
    }

    const token = result.rows[0];

    if (token.revoked_at) {
      await client.query("COMMIT");
      transactionStarted = false;

      return { success: false };
    }

    // Phiên mới: thu hồi toàn bộ phiên đăng nhập
    if (token.session_id) {
      const sessionResult = await client.query(
        `
        UPDATE auth.user_sessions
        SET revoked_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND revoked_at IS NULL
        RETURNING id
        `,
        [token.session_id, token.user_id]
      );

      if (sessionResult.rowCount !== 1) {
        await client.query("COMMIT");
        transactionStarted = false;

        return { success: false };
      }

      // Thu hồi tất cả refresh token thuộc phiên
      await client.query(
        `
        UPDATE auth.refresh_tokens
        SET
          revoked_at = NOW(),
          revoke_reason = 'logout'
        WHERE session_id = $1
          AND revoked_at IS NULL
        `,
        [token.session_id]
      );

      // Ghi nhận sự kiện đăng xuất
      await client.query(
        `
        INSERT INTO auth.session_events (
          session_id,
          user_id,
          event_type,
          ip_address,
          user_agent,
          metadata
        )
        VALUES (
          $1,
          $2,
          'logout',
          $3,
          $4,
          $5::jsonb
        )
        `,
        [
          token.session_id,
          token.user_id,
          ip || null,
          userAgent || null,
          JSON.stringify({
            reason: "user_logout",
          }),
        ]
      );
    } else {
      // Tương thích refresh token cũ chưa có session_id
      await client.query(
        `
        UPDATE auth.refresh_tokens
        SET
          revoked_at = NOW(),
          revoke_reason = 'logout'
        WHERE id = $1
          AND revoked_at IS NULL
        `,
        [token.id]
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return { success: true };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Giữ nguyên lỗi ban đầu.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}


export async function getMe(userId: string) {
  const result = await pool.query(
    `
    SELECT
      id,
      email,
      phone,
      status,
      phone_verified_at,
      email_verified_at,
      last_login_at,
      created_at,
      updated_at
    FROM auth.users
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  const user = result.rows[0];

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    status: user.status,
    phoneVerified: !!user.phone_verified_at,
    emailVerified: !!user.email_verified_at,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}


export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Khóa tài khoản trong quá trình đổi mật khẩu
    const result = await client.query(
      `
      SELECT id, password_hash
      FROM auth.users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    const user = result.rows[0];

    // Kiểm tra mật khẩu hiện tại
    const passwordValid = await comparePassword(
      currentPassword,
      user.password_hash
    );

    if (!passwordValid) {
      throw new Error("CURRENT_PASSWORD_INVALID");
    }

    if (currentPassword === newPassword) {
      throw new Error("PASSWORD_SAME");
    }

    // Hash mật khẩu mới
    const newPasswordHash = await hashPassword(newPassword);

    // Cập nhật mật khẩu
    await client.query(
      `
      UPDATE auth.users
      SET
        password_hash = $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [newPasswordHash, userId]
    );

    // Thu hồi toàn bộ refresh token còn hiệu lực
    await client.query(
      `
      UPDATE auth.refresh_tokens
      SET
        revoked_at = NOW(),
        revoke_reason = 'password_changed'
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [userId]
    );

    // Thu hồi tất cả phiên đăng nhập còn hoạt động
    // Đồng thời ghi nhận sự kiện cho từng phiên
    await client.query(
      `
      WITH revoked_sessions AS (
        UPDATE auth.user_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
        RETURNING id, user_id
      )
      INSERT INTO auth.session_events (
        session_id,
        user_id,
        event_type,
        metadata
      )
      SELECT
        id,
        user_id,
        'password_changed',
        jsonb_build_object(
          'reason',
          'password_changed'
        )
      FROM revoked_sessions
      `,
      [userId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      success: true,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Giữ nguyên lỗi ban đầu.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}


export async function forgotPassword(
  email: string,
  ip?: string,
  userAgent?: string
) {
  const result = await pool.query(
    `SELECT id, email, status
     FROM auth.users
     WHERE email = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [email]
  );

  // Không tiết lộ email có tồn tại hay không
  if (result.rows.length === 0) {
    return {
      success: true,
      resetToken: null,
    };
  }

  const user = result.rows[0];

  // Hủy các token reset cũ chưa sử dụng
  await pool.query(
    `UPDATE auth.password_reset_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND used_at IS NULL
       AND revoked_at IS NULL`,
    [user.id]
  );

  const resetToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(resetToken);

  await pool.query(
    `INSERT INTO auth.password_reset_tokens (
       user_id,
       token_hash,
       expires_at,
       created_ip,
       created_user_agent
     )
     VALUES (
       $1,
       $2,
       NOW() + INTERVAL '15 minutes',
       $3,
       $4
     )`,
    [
      user.id,
      tokenHash,
      ip || null,
      userAgent || null,
    ]
  );

  return {
    success: true,
    resetToken,
  };
}


export async function resetPassword(
  userId: string,
  token: string,
  newPassword: string
) {
  const tokenHash = hashPasswordResetToken(token);
  const passwordHash = await hashPassword(newPassword);

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Khóa token đặt lại mật khẩu
    const result = await client.query(
      `
      SELECT
        id,
        user_id,
        expires_at,
        used_at,
        revoked_at
      FROM auth.password_reset_tokens
      WHERE token_hash = $1
      LIMIT 1
      FOR UPDATE
      `,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw new Error("RESET_TOKEN_NOT_FOUND");
    }

    const resetToken = result.rows[0];

    if (
      String(resetToken.user_id) !== String(userId)
    ) {
      throw new Error("RESET_TOKEN_INVALID");
    }

    if (resetToken.used_at) {
      throw new Error("RESET_TOKEN_USED");
    }

    if (resetToken.revoked_at) {
      throw new Error("RESET_TOKEN_REVOKED");
    }

    if (
      new Date(resetToken.expires_at).getTime() <=
      Date.now()
    ) {
      throw new Error("RESET_TOKEN_EXPIRED");
    }

    // Kiểm tra tài khoản tồn tại
    const userResult = await client.query(
      `
      SELECT id
      FROM auth.users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    // Cập nhật mật khẩu mới
    const updateUser = await client.query(
      `
      UPDATE auth.users
      SET
        password_hash = $1,
        updated_at = NOW()
      WHERE id = $2
        AND deleted_at IS NULL
      RETURNING id
      `,
      [passwordHash, userId]
    );

    if (updateUser.rowCount !== 1) {
      throw new Error("USER_NOT_FOUND");
    }

    // Đánh dấu token đặt lại mật khẩu đã sử dụng
    const updateResetToken = await client.query(
      `
      UPDATE auth.password_reset_tokens
      SET used_at = NOW()
      WHERE id = $1
        AND used_at IS NULL
        AND revoked_at IS NULL
      RETURNING id
      `,
      [resetToken.id]
    );

    if (updateResetToken.rowCount !== 1) {
      throw new Error("RESET_TOKEN_USED");
    }

    // Thu hồi toàn bộ refresh token
    await client.query(
      `
      UPDATE auth.refresh_tokens
      SET
        revoked_at = NOW(),
        revoke_reason = 'password_reset'
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [userId]
    );

    // Thu hồi tất cả phiên đăng nhập
    // Đồng thời ghi nhận sự kiện cho từng phiên
    await client.query(
      `
      WITH revoked_sessions AS (
        UPDATE auth.user_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
        RETURNING id, user_id
      )
      INSERT INTO auth.session_events (
        session_id,
        user_id,
        event_type,
        metadata
      )
      SELECT
        id,
        user_id,
        'password_reset',
        jsonb_build_object(
          'reason',
          'password_reset'
        )
      FROM revoked_sessions
      `,
      [userId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      success: true,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Giữ nguyên lỗi ban đầu.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function getCurrentUser(userId: string) {
  const result = await pool.query(
    `
    SELECT
      id,
      phone,
      email,
      status,
      phone_verified_at,
      email_verified_at,
      last_login_at,
      created_at
    FROM auth.users
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  const user = result.rows[0];

  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    status: user.status,
    phoneVerified: Boolean(user.phone_verified_at),
    emailVerified: Boolean(user.email_verified_at),
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  };
}



export async function getActiveSessions(
  userId: string,
  currentSessionId?: string
) {
  const result = await pool.query(
    `
    SELECT
      id,
      device_id,
      device_name,
      platform,
      ip_address,
      user_agent,
      expires_at,
      created_at,
      (id = $2::uuid) AS is_current
    FROM auth.user_sessions
    WHERE user_id = $1
      AND revoked_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    `,
    [userId, currentSessionId || null]
  );

  return result.rows;
}




export async function revokeSession(
  userId: string,
  sessionId: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sessionResult = await client.query(
      `
      UPDATE auth.user_sessions
      SET revoked_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND revoked_at IS NULL
      RETURNING id
      `,
      [sessionId, userId]
    );

    if (sessionResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `
      UPDATE auth.refresh_tokens
      SET
        revoked_at = NOW(),
        revoke_reason = 'session_revoked'
      WHERE session_id = $1
        AND user_id = $2
        AND revoked_at IS NULL
      `,
      [sessionId, userId]
    );

    await client.query(
      `
      INSERT INTO auth.session_events (
        session_id,
        user_id,
        event_type,
        metadata
      )
      VALUES ($1, $2, 'session_revoked', $3)
      `,
      [
        sessionId,
        userId,
        JSON.stringify({ reason: "user_revoked_session" }),
      ]
    );

    await client.query("COMMIT");

    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE auth.user_sessions
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND id != $2
        AND revoked_at IS NULL
      RETURNING id
      `,
      [userId, currentSessionId]
    );

    const revokedSessionIds = result.rows.map(
      (row: { id: string }) => row.id
    );

    if (revokedSessionIds.length > 0) {
      await client.query(
        `
        UPDATE auth.refresh_tokens
        SET
          revoked_at = NOW(),
          revoke_reason = 'other_sessions_revoked'
        WHERE user_id = $1
          AND session_id = ANY($2::uuid[])
          AND revoked_at IS NULL
        `,
        [userId, revokedSessionIds]
      );

      for (const sessionId of revokedSessionIds) {
        await client.query(
          `
          INSERT INTO auth.session_events (
            session_id,
            user_id,
            event_type,
            metadata
          )
          VALUES ($1, $2, 'session_revoked', $3)
          `,
          [
            sessionId,
            userId,
            JSON.stringify({
              reason: "other_sessions_revoked",
            }),
          ]
        );
      }
    }

    await client.query("COMMIT");

    return revokedSessionIds.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


export async function createEmailVerificationToken(
  userId: string,
  ip?: string,
  userAgent?: string
) {
  const token = generateEmailVerificationToken();
  const tokenHash = hashEmailVerificationToken(token);

  // Vô hiệu hóa các token cũ
  await pool.query(
    `
    UPDATE auth.email_verification_tokens
    SET revoked_at = NOW()
    WHERE user_id = $1
      AND used_at IS NULL
      AND revoked_at IS NULL
    `,
    [userId]
  );

  // Tạo token mới, có hiệu lực 15 phút
  await pool.query(
    `
    INSERT INTO auth.email_verification_tokens (
      user_id,
      token_hash,
      expires_at,
      created_ip,
      created_user_agent
    )
    VALUES (
      $1,
      $2,
      NOW() + INTERVAL '15 minutes',
      $3,
      $4
    )
    `,
    [
      userId,
      tokenHash,
      ip || null,
      userAgent || null,
    ]
  );

  return token;
}


async function createResendVerificationToken(
  userId: string,
  ip?: string,
  userAgent?: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Khóa tài khoản để tránh hai yêu cầu gửi đồng thời
    const userResult = await client.query(
      `
      SELECT id
      FROM auth.users
      WHERE id = $1
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    // Kiểm tra số lần gửi trong 1 giờ
    const statsResult = await client.query(
      `
      SELECT
        COUNT(*)::int AS sent_count,
        MAX(created_at) AS last_sent_at
      FROM auth.email_verification_tokens
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '1 hour'
      `,
      [userId]
    );

    const stats = statsResult.rows[0];

    if (stats.sent_count >= 5) {
      throw new Error("OTP_RESEND_LIMIT_EXCEEDED");
    }

    if (stats.last_sent_at) {
      const elapsed =
        Date.now() -
        new Date(stats.last_sent_at).getTime();

      if (elapsed < 60 * 1000) {
        throw new Error("OTP_RESEND_TOO_SOON");
      }
    }

    const token = generateEmailVerificationToken();
    const tokenHash = hashEmailVerificationToken(token);

    await client.query(
      `
      UPDATE auth.email_verification_tokens
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND used_at IS NULL
        AND revoked_at IS NULL
      `,
      [userId]
    );

    await client.query(
      `
      INSERT INTO auth.email_verification_tokens (
        user_id,
        token_hash,
        expires_at,
        created_ip,
        created_user_agent
      )
      VALUES (
        $1,
        $2,
        NOW() + INTERVAL '15 minutes',
        $3,
        $4
      )
      `,
      [
        userId,
        tokenHash,
        ip || null,
        userAgent || null,
      ]
    );

    await client.query("COMMIT");

    return token;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}




export async function verifyEmail(
  userId: string,
  token: string
) {
  const client = await pool.connect();

  let verificationError: string | null = null;

  try {
    await client.query("BEGIN");

    // Khóa tài khoản trước để thống nhất thứ tự khóa với luồng gửi lại OTP
    const userResult = await client.query(
      `
      SELECT id
      FROM auth.users
      WHERE id = $1
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    // Khóa OTP mới nhất của tài khoản
    const result = await client.query(
      `
      SELECT
        id,
        user_id,
        token_hash,
        expires_at,
        used_at,
        revoked_at,
        attempt_count
      FROM auth.email_verification_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error("VERIFICATION_TOKEN_NOT_FOUND");
    }

    const verificationToken = result.rows[0];

    if (verificationToken.used_at) {
      throw new Error("VERIFICATION_TOKEN_USED");
    }

    if (verificationToken.revoked_at) {
      throw new Error("VERIFICATION_TOKEN_REVOKED");
    }

    if (
      new Date(verificationToken.expires_at).getTime() <
      Date.now()
    ) {
      throw new Error("VERIFICATION_TOKEN_EXPIRED");
    }

    if (verificationToken.attempt_count >= 5) {
      throw new Error("VERIFICATION_TOKEN_ATTEMPTS_EXCEEDED");
    }

    const tokenHash = hashEmailVerificationToken(token);

    // OTP sai
    if (verificationToken.token_hash !== tokenHash) {
      const nextAttempt = verificationToken.attempt_count + 1;

      await client.query(
        `
        UPDATE auth.email_verification_tokens
        SET
          attempt_count = $2,
          revoked_at = CASE
            WHEN $2 >= 5 THEN NOW()
            ELSE revoked_at
          END
        WHERE id = $1
        `,
        [verificationToken.id, nextAttempt]
      );

      await client.query("COMMIT");

      verificationError =
        nextAttempt >= 5
          ? "VERIFICATION_TOKEN_ATTEMPTS_EXCEEDED"
          : "VERIFICATION_TOKEN_INVALID";
    } else {

      await client.query(
        `
        UPDATE auth.email_verification_tokens
        SET used_at = NOW()
        WHERE id = $1
        `,
        [verificationToken.id]
      );

      const updateUser = await client.query(        `
        UPDATE auth.users
        SET
          status = 'active',
          email_verified_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
          AND status = 'pending'
        `,
        [userId]
      );

      if (updateUser.rowCount !== 1) {
        throw new Error("ACCOUNT_NOT_PENDING");
      }
      
      await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (verificationError) {
    throw new Error(verificationError);
  }

  return {
    success: true,
  };
}



export async function resendVerification(
  userId: string,
  ip?: string,
  userAgent?: string
) {
  const result = await pool.query(
    `SELECT id, email, status, email_verified_at
     FROM auth.users
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  const user = result.rows[0];

  if (!user.email) {
    throw new Error("EMAIL_NOT_AVAILABLE");
  }

  if (user.status === "blocked") {
    throw new Error("ACCOUNT_BLOCKED");
  }

  if (user.status !== "pending") {
    if (user.status === "active" || user.email_verified_at) {
      throw new Error("EMAIL_ALREADY_VERIFIED");
    }

    throw new Error("ACCOUNT_NOT_ACTIVE");
  }

  const verificationToken = await createResendVerificationToken(
    user.id,
    ip,
    userAgent
  );

  let emailSent = false;

  try {
    await sendVerificationEmail(
      user.email,
      verificationToken
    );

    emailSent = true;
  } catch (error) {
    console.error("SEND_VERIFICATION_EMAIL_FAILED:", error);
  }

  return {
    success: true,
    email: user.email,
    emailSent,
  };
}


export async function resendVerificationWithPassword(
  identifier: string,
  password: string,
  ip?: string,
  userAgent?: string
) {
  const normalizedIdentifier = identifier.trim();
  const isEmail = normalizedIdentifier.includes("@");

  const result = await pool.query(
    `
    SELECT id, email, phone, password_hash, status, email_verified_at
    FROM auth.users
    WHERE (
      ($2 = TRUE AND LOWER(email) = LOWER($1))
      OR ($2 = FALSE AND phone = $1)
    )
    AND deleted_at IS NULL
    LIMIT 1
    `,
    [normalizedIdentifier, isEmail]
  );

  if (result.rows.length === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const user = result.rows[0];

  const passwordValid = await comparePassword(
    password,
    user.password_hash
  );

  if (!passwordValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.status !== "pending") {
    if (user.status === "blocked") {
      throw new Error("ACCOUNT_BLOCKED");
    }

    throw new Error("ACCOUNT_NOT_PENDING");
  }

  if (!user.email) {
    throw new Error("EMAIL_NOT_AVAILABLE");
  }

  if (user.email_verified_at) {
    throw new Error("EMAIL_ALREADY_VERIFIED");
  }

  const verificationToken = await createResendVerificationToken(
    user.id,
    ip,
    userAgent
  );

  if (
    process.env.NODE_ENV === "development" &&
    user.email?.toLowerCase() === "manager.test@tue-nguyen.local"
  ) {
    console.log("[DEV TEST] Manager verification OTP:", verificationToken);
  }

  let emailSent = false;

  try {
    await sendVerificationEmail(
      user.email,
      verificationToken
    );
    emailSent = true;
  } catch (error) {
    console.error("SEND_VERIFICATION_EMAIL_FAILED:", error);
  }

    return {
    success: true,
    userId: user.id,
    email: user.email,
    emailSent,
  };
}

