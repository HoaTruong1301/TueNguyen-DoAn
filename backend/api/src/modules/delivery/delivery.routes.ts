import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  requireAdmin,
  requirePermission
} from "../../middleware/admin.middleware";

import {
  getMyDeliveryOrdersController,
  getMyDeliveryDetailController,
  getMyDeliveryTrackingController,
  getAdminDeliveryOrdersController,
  assignDeliveryController,
  updateDeliveryStatusController,
  updateDeliveryLocationController
} from "./delivery.controller";

const router = Router();

// Khách hàng
router.get(
  "/my-orders",
  requireAuth,
  getMyDeliveryOrdersController
);

router.get(
  "/orders/:orderId/tracking",
  requireAuth,
  getMyDeliveryTrackingController
);

router.get(
  "/orders/:orderId",
  requireAuth,
  getMyDeliveryDetailController
);

// Quản trị viên
router.get(
  "/admin/orders",
  requireAdmin,
  requirePermission("delivery.view"),
  getAdminDeliveryOrdersController
);

router.patch(
  "/admin/orders/:orderId/assign",
  requireAdmin,
  requirePermission("delivery.manage"),
  assignDeliveryController
);

router.patch(
  "/admin/orders/:orderId/status",
  requireAdmin,
  requirePermission("delivery.manage"),
  updateDeliveryStatusController
);

router.post(
  "/admin/orders/:orderId/tracking",
  requireAdmin,
  requirePermission("delivery.manage"),
  updateDeliveryLocationController
);

export default router;