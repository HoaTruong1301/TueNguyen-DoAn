import { Router } from "express";
import {
  getMyNotifications,
  getMyUnreadCount,
  markAsRead,
  markAllAsRead,
  registerDeviceTokenController,
} from "./notification.controller";

import { requireAuth  } from "../../middleware/auth.middleware";

const router = Router();

router.post(
  "/device-token",
  requireAuth,
  registerDeviceTokenController
);

router.get("/", requireAuth , getMyNotifications);

router.get("/unread-count", requireAuth , getMyUnreadCount);

router.patch("/read-all", requireAuth , markAllAsRead);

router.patch("/:id/read", requireAuth , markAsRead);

export default router;