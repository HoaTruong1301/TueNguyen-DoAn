
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  createOrder,
  getMyOrders,
  getMyOrderDetail,
  cancelOrder
} from "./orders.controller";

const router = Router();

router.use(requireAuth);

router.post("/", createOrder);
router.get("/", getMyOrders);
router.get("/:id", getMyOrderDetail);
router.post("/:id/cancel", cancelOrder);

export default router;
