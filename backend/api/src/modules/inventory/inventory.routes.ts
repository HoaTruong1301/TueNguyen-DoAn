import { Router, Response } from "express";
import {
  requireAdmin,
  requirePermission,
} from "../../middleware/admin.middleware";
import type { AdminRequest } from "../../middleware/admin.middleware";
import * as svc from "./inventory.service";

const router = Router();

function qs(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof svc.InventoryError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "INVALID_STATE"
        ? 409
        : 400;
    return res.status(status).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

function uid(req: AdminRequest): string {
  return req.admin!.userId;
}

const view = [requireAdmin, requirePermission("inventory.view")];
const manage = [requireAdmin, requirePermission("inventory.manage")];

router.get("/warehouses", ...view, async (_req, res) => {
  try {
    res.json({ success: true, data: await svc.listWarehouses() });
  } catch (e) {
    fail(res, e, "Không thể tải danh sách kho");
  }
});

router.get("/items", ...view, async (_req, res) => {
  try {
    res.json({ success: true, data: await svc.listItems() });
  } catch (e) {
    fail(res, e, "Không thể tải nguyên liệu");
  }
});

router.post("/items", ...manage, async (req: AdminRequest, res) => {
  try {
    res.status(201).json({ success: true, data: await svc.createItem(req.body ?? {}) });
  } catch (e) {
    fail(res, e, "Không thể tạo nguyên liệu");
  }
});

router.get("/stock", ...view, async (req, res) => {
  try {
    res.json({
      success: true,
      data: await svc.getStockOverview(qs(req.query.warehouseId)),
    });
  } catch (e) {
    fail(res, e, "Không thể tải tồn kho");
  }
});

router.get("/movements", ...view, async (req, res) => {
  try {
    res.json({
      success: true,
      data: await svc.listMovements({
        itemId: qs(req.query.itemId),
        warehouseId: qs(req.query.warehouseId),
        type: qs(req.query.type),
        limit: Number(req.query.limit),
      }),
    });
  } catch (e) {
    fail(res, e, "Không thể tải lịch sử kho");
  }
});

router.get("/purchase-orders", ...view, async (_req, res) => {
  try {
    res.json({ success: true, data: await svc.listPurchaseOrders() });
  } catch (e) {
    fail(res, e, "Không thể tải đơn đặt hàng");
  }
});

router.post("/purchase-orders", ...manage, async (req: AdminRequest, res) => {
  try {
    const data = await svc.createPurchaseOrder(req.body ?? {}, uid(req));
    res.status(201).json({ success: true, data });
  } catch (e) {
    fail(res, e, "Không thể tạo đơn đặt hàng");
  }
});

router.post(
  "/purchase-orders/:id/receive",
  ...manage,
  async (req: AdminRequest, res) => {
    try {
      await svc.receivePurchaseOrderById(String(req.params.id), uid(req));
      res.json({ success: true, message: "Đã nhận hàng và cộng vào tồn kho" });
    } catch (e) {
      fail(res, e, "Không thể nhận hàng");
    }
  }
);

router.post(
  "/purchase-orders/:id/cancel",
  ...manage,
  async (req: AdminRequest, res) => {
    try {
      await svc.cancelPurchaseOrder(String(req.params.id));
      res.json({ success: true, message: "Đã huỷ đơn đặt hàng" });
    } catch (e) {
      fail(res, e, "Không thể huỷ đơn đặt hàng");
    }
  }
);

router.get("/transfers", ...view, async (_req, res) => {
  try {
    res.json({ success: true, data: await svc.listTransfers() });
  } catch (e) {
    fail(res, e, "Không thể tải phiếu điều chuyển");
  }
});

router.post("/transfers", ...manage, async (req: AdminRequest, res) => {
  try {
    const data = await svc.createTransfer(req.body ?? {}, uid(req));
    res.status(201).json({ success: true, data });
  } catch (e) {
    fail(res, e, "Không thể điều chuyển kho");
  }
});

router.post("/waste", ...manage, async (req: AdminRequest, res) => {
  try {
    const data = await svc.createWaste(req.body ?? {}, uid(req));
    res.status(201).json({ success: true, data });
  } catch (e) {
    fail(res, e, "Không thể huỷ hàng");
  }
});

router.get("/recipes", ...view, async (_req, res) => {
  try {
    res.json({ success: true, data: await svc.listFoodsWithRecipe() });
  } catch (e) {
    fail(res, e, "Không thể tải công thức");
  }
});

router.put("/recipes/:foodId", ...manage, async (req: AdminRequest, res) => {
  try {
    const data = await svc.saveRecipe(String(req.params.foodId), req.body?.items);
    res.json({ success: true, data });
  } catch (e) {
    fail(res, e, "Không thể lưu công thức");
  }
});

export default router;
