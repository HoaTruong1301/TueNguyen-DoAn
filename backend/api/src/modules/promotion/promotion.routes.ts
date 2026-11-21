import { requireAuth } from "../../middleware/auth.middleware";import { Router } from "express";

import {
  getActiveVouchers,
  getVoucherById,
  validateVoucher,
  getMyVoucherHistory,
} from "./promotion.controller";

const router = Router();

router.get("/vouchers", getActiveVouchers);
router.post(
  "/vouchers/validate",
  requireAuth,
  validateVoucher
);
router.get(
  "/vouchers/my-history",
  requireAuth,
  getMyVoucherHistory
);
router.get("/vouchers/:id", getVoucherById);

export default router;
