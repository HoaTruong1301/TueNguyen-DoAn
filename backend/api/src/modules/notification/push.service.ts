import pool from "../../database/postgres";
import { firebaseMessaging } from "../../config/firebase-admin";

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token"
]);

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  try {
    const result = await pool.query<{ id: string; fcm_token: string }>(
      `SELECT id, fcm_token
       FROM notification.device_tokens
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return;
    }

    const tokens = result.rows.map((row) => row.fcm_token);

    const response = await firebaseMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body
      },
      data,
      android: {
        priority: "high",
        notification: {
          channelId: "default"
        }
      }
    });

    const invalidTokenIds: string[] = [];

    response.responses.forEach((item, index) => {
      if (
        !item.success &&
        item.error &&
        INVALID_TOKEN_CODES.has(item.error.code)
      ) {
        const invalidToken = result.rows[index];

        if (invalidToken) {
          invalidTokenIds.push(invalidToken.id);
        }
      }
    });

    if (invalidTokenIds.length > 0) {
      await pool.query(
        `DELETE FROM notification.device_tokens
         WHERE id = ANY($1::uuid[])`,
        [invalidTokenIds]
      );
    }

    console.log(
      `FCM: gửi ${response.successCount}/${tokens.length} thiết bị cho user ${userId}.`
    );
  } catch (error) {
    console.error("FCM push notification error:", error);
  }
}
