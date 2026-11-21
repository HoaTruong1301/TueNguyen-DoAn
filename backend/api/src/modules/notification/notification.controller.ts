import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
  registerDeviceToken,
} from "./notification.service";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./notification.service";

function getUserId(req: AuthRequest, res: Response) {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      message: "Vui lòng đăng nhập",
    });
    return null;
  }

  return req.user.id;
}

export async function getMyNotifications(
  req: AuthRequest,
  res: Response
) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const limit = Math.min(
    Math.max(Number(req.query.limit) || 20, 1),
    100
  );

  const offset = Math.max(
    Number(req.query.offset) || 0,
    0
  );

  try {
    const data = await getNotifications(userId, limit, offset);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Lỗi lấy thông báo:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách thông báo",
    });
  }
}

export async function getMyUnreadCount(
  req: AuthRequest,
  res: Response
) {
  const userId = getUserId(req, res);
  if (!userId) return;

  try {
    const unreadCount = await getUnreadNotificationCount(userId);

    return res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    console.error("Lỗi đếm thông báo:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể đếm thông báo chưa đọc",
    });
  }
}

export async function markAsRead(
  req: AuthRequest,
  res: Response
) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const parsed = z.string().uuid().safeParse(req.params.id);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "ID thông báo không hợp lệ",
    });
  }

  try {
    const updated = await markNotificationAsRead(
      userId,
      parsed.data
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo",
      });
    }

    return res.json({
      success: true,
      message: "Đã đánh dấu thông báo đã đọc",
    });
  } catch (error) {
    console.error("Lỗi cập nhật thông báo:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật thông báo",
    });
  }
}

export async function markAllAsRead(
  req: AuthRequest,
  res: Response
) {
  const userId = getUserId(req, res);
  if (!userId) return;

  try {
    const updatedCount = await markAllNotificationsAsRead(userId);

    return res.json({
      success: true,
      data: { updatedCount },
      message: "Đã đánh dấu tất cả thông báo đã đọc",
    });
  } catch (error) {
    console.error("Lỗi cập nhật thông báo:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật thông báo",
    });
  }
}

export async function registerDeviceTokenController(
  req: AuthRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { token, platform } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa xác thực người dùng.",
      });
    }

    if (
      typeof token !== "string" ||
      !token.trim() ||
      token.length > 4096
    ) {
      return res.status(400).json({
        success: false,
        message: "FCM token không hợp lệ.",
      });
    }

    const devicePlatform =
      typeof platform === "string" &&
      ["android", "ios"].includes(platform.toLowerCase())
        ? platform.toLowerCase()
        : "android";

    await registerDeviceToken(
      userId,
      token.trim(),
      devicePlatform
    );

    return res.json({
      success: true,
      message: "Đăng ký thiết bị nhận thông báo thành công.",
    });
  } catch (error) {
    console.error("Register device token error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể đăng ký thiết bị nhận thông báo.",
    });
  }
}