
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin, requirePermission } from "../../middleware/admin.middleware";
import {
  createFoodReview,
  getFoodReviews,
  getFoodReviewStatus,
  createOrderReview,
  getOrderReviewStatus,
  getAdminReviews,
  moderateReview,
  replyToReviewController,
} from "./review.controller";

const router = Router();

router.get(
  "/admin",
  requireAdmin,
  requirePermission("review.view"),
  getAdminReviews
);

router.patch(
  "/admin/:id/moderate",
  requireAdmin,
  requirePermission("review.manage"),
  moderateReview
);

router.post(
  "/admin/:id/reply",
  requireAdmin,
  requirePermission("review.manage"),
  replyToReviewController
);

// Đánh giá đơn hàng
router.post("/order", requireAuth, createOrderReview);
router.get("/order/status", requireAuth, getOrderReviewStatus);

// Kiểm tra trạng thái đánh giá món ăn
// Phải đặt trước /food/:foodId để tránh bị hiểu nhầm là foodId.
router.get("/food/status", requireAuth, getFoodReviewStatus);

// Đánh giá món ăn cũ
router.post("/food", requireAuth, createFoodReview);
router.get("/food/:foodId", getFoodReviews);

export default router;
