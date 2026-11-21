
import { Router, Response } from "express";
import {
  getAdminMemberDetailController,
} from "./admin-member-detail.controller";
import {
  requireAdmin,
  requirePermission,
} from "../../middleware/admin.middleware";
import type { AdminRequest } from "../../middleware/admin.middleware";
import { getDashboardOverview } from "./admin-dashboard.service";
import { getAdminOrders } from "./admin-orders.service";
import { getAdminOrderDetail } from "./admin-order-detail.service";
import { updateAdminOrderStatus } from "./admin-order-status.service";
import { getAdminMembersController } from "./admin-members.controller";
import {
  getAdminFoods,
  getAdminFoodCategories,
  createAdminFood,
  updateAdminFood,
  updateAdminFoodStatus,
  deleteAdminFood,
  getAdminFoodOptions,
  saveAdminFoodOptions,
} from "./admin-food.service";
import {
  uploadMenuImage,
  uploadBannerImage,
} from "../../middleware/upload.middleware";const router = Router();

import {
  updateAdminMemberProfileController,
} from "./admin-member-profile.controller";

import {
  applyManualDiscount,
  AuditError,
  getStaffActivitySummary,
  getStaffActivityEvents,
} from "./admin-staff-audit.service";
import { validateBody } from "../../middleware/validate";
import {
  updateAdminMemberProfileSchema,
} from "./admin-member-profile.schema";

import {
  getAdminStaffController,
  createAdminStaffController,
  getAdminStaffRolesController,
  updateAdminStaffRoleController,
  updateAdminStaffStatusController,
  getAdminStaffActivityLogsController
} from "./admin-staff.controller";

import {
  getAdminBannersController,
  createAdminBannerController,
  updateAdminBannerController,
  updateAdminBannerStatusController,
  deleteAdminBannerController,
} from "./admin-banner.controller";

import {
  getAdminVouchersController,
  getAdminVoucherDetailController,
  createAdminVoucherController,
  updateAdminVoucherController,
  updateAdminVoucherStatusController,
  deleteAdminVoucherController,
} from "./admin-voucher.controller";



/**
 * GET /api/v1/admin/me
 * Xem thÃ´ng tin tÃ i khoáº£n quáº£n trá»‹ hiá»‡n táº¡i.
 */
router.get(
  "/me",
  requireAdmin,
  (req: AdminRequest, res: Response) => {
    return res.status(200).json({
      success: true,
      data: {
        adminId: req.admin?.id,
        userId: req.admin?.userId,
        roles: req.admin?.roles ?? [],
      },
    });
  }
);

router.get(
  "/members",
  requireAdmin,
  requirePermission("member.view"),
  getAdminMembersController
);

router.get(
  "/members/:id",
  requireAdmin,
  requirePermission("member.view_detail"),
  getAdminMemberDetailController
);

router.patch(
  "/members/:id/profile",
  requireAdmin,
  requirePermission("member.edit"),
  validateBody(updateAdminMemberProfileSchema),
  updateAdminMemberProfileController
);

/**
 * GET /api/v1/admin/dashboard/access
 * Kiá»ƒm tra tÃ i khoáº£n cÃ³ quyá»n xem dashboard hay khÃ´ng.
 */
router.get(
  "/dashboard/access",
  requireAdmin,
  requirePermission("dashboard.view"),
  (_req: AdminRequest, res: Response) => {
    return res.status(200).json({
      success: true,
      message: "Báº¡n cÃ³ quyá»n truy cáº­p dashboard",
    });
  }
);


router.get(
  "/dashboard/overview",
  requireAdmin,
  requirePermission("dashboard.view"),
  async (_req, res) => {
    try {
      const data = await getDashboardOverview();

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Lá»—i cáº­p nháº­t tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng:", error);

      return res.status(500).json({
        success: false,
        message: "KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng",
      });
    }
  }
);

router.get(
  "/orders",
  requireAdmin,
  requirePermission("order.view"),
  async (req, res) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 10);
      const status =
        typeof req.query.status === "string"
          ? req.query.status
          : undefined;
      const search =
        typeof req.query.search === "string"
          ? req.query.search
          : undefined;

      const sortBy =
        typeof req.query.sortBy === "string"
          ? req.query.sortBy
          : "newest";
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "page pháº£i >= 1; limit pháº£i tá»« 1 Ä‘áº¿n 100",
        });
      }

      const data = await getAdminOrders({
        page,
        limit,
        status,
        search,
        sortBy: sortBy as "newest" | "oldest" | "highest",
      });
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "INVALID_ORDER_SORT"
      ) {
        return res.status(400).json({
          success: false,
          message: "Kiá»ƒu sáº¯p xáº¿p Ä‘Æ¡n hÃ ng khÃ´ng há»£p lá»‡",
        });
      }

      console.error("Lá»—i láº¥y danh sÃ¡ch Ä‘Æ¡n hÃ ng quáº£n trá»‹:", error);

      return res.status(500).json({
        success: false,
        message: "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch Ä‘Æ¡n hÃ ng",
      });
    }
  }
);

router.get(
  "/orders/:id",
  requireAdmin,
  requirePermission("order.detail"),
  async (req: AdminRequest, res) => {
    try {
      
        const rawOrderId = req.params.id;

        if (typeof rawOrderId !== "string") {
        return res.status(400).json({
            success: false,
            message: "ID Ä‘Æ¡n hÃ ng khÃ´ng há»£p lá»‡",
        });
        }

        const orderId = rawOrderId;

        const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidPattern.test(orderId)) {
        return res.status(400).json({
            success: false,
            message: "ID Ä‘Æ¡n hÃ ng khÃ´ng há»£p lá»‡",
        });
        }

        const data = await getAdminOrderDetail(orderId);


      if (!data) {
        return res.status(404).json({
          success: false,
          message: "KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng",
        });
      }

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Lá»—i láº¥y chi tiáº¿t Ä‘Æ¡n hÃ ng:", error);

      return res.status(500).json({
        success: false,
        message: "KhÃ´ng thá»ƒ táº£i chi tiáº¿t Ä‘Æ¡n hÃ ng",
      });
    }
  }
);

router.patch(
  "/orders/:id/status",
  requireAdmin,
  requirePermission("order.update"),
  async (req: AdminRequest, res: Response) => {
    try {
      const rawOrderId = req.params.id;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (
        typeof rawOrderId !== "string" ||
        !uuidPattern.test(rawOrderId)
      ) {
        return res.status(400).json({
          success: false,
          message: "ID Ä‘Æ¡n hÃ ng khÃ´ng há»£p lá»‡",
        });
      }

      const { status, note } = req.body ?? {};

      const normalizedNote =
        typeof note === "string" ? note.normalize("NFC").trim() : note;

      if (
        typeof status !== "string" ||
        (note !== undefined && typeof note !== "string")
      ) {
        return res.status(400).json({
          success: false,
          message: "Dá»¯ liá»‡u cáº­p nháº­t khÃ´ng há»£p lá»‡",
        });
      }

      const adminUserId = req.admin?.userId;

      if (!adminUserId) {
        return res.status(403).json({
          success: false,
          message: "KhÃ´ng xÃ¡c Ä‘á»‹nh Ä‘Æ°á»£c tÃ i khoáº£n quáº£n trá»‹",
        });
      }

      const result = await updateAdminOrderStatus(
        rawOrderId,
        status,
        adminUserId,
        normalizedNote
      );

      if ("error" in result) {
        if (result.error === "NOT_FOUND") {
          return res.status(404).json({
            success: false,
            message: "KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng",
          });
        }

        if (result.error === "REASON_REQUIRED") {
          return res.status(400).json({
            success: false,
            message: "Vui lÃ²ng nháº­p lÃ½ do tá»« chá»‘i hoáº·c há»§y Ä‘Æ¡n",
          });
        }

        return res.status(409).json({
          success: false,
          message: "KhÃ´ng thá»ƒ chuyá»ƒn sang tráº¡ng thÃ¡i nÃ y",
          currentStatus:
            "currentStatus" in result
              ? result.currentStatus
              : undefined,
          allowedStatuses:
            "allowedStatuses" in result
              ? result.allowedStatuses
              : [],
        });
      }

      return res.status(200).json({
        success: true,
        message: "Cáº­p nháº­t tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng thÃ nh cÃ´ng",
        data: result.data,
      });
    } catch (error) {
      console.error("PATCH /orders/:id/status failed:", error);

      return res.status(500).json({
        success: false,
        message: "KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng",
      });
    }
  }
);



// ===== QUẢN LÝ MÓN ĂN =====

// ===== QUẢN LÝ NHÓM TÙY CHỌN MÓN ĂN =====

router.get(
  "/foods/:id/options",
  requireAdmin,
  requirePermission("food.view"),
  async (req, res) => {
    try {
      const data = await getAdminFoodOptions(String(req.params.id));

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy món ăn",
        });
      }

      return res.json({ success: true, data });
    } catch (error) {
      console.error("Lỗi lấy tùy chọn món ăn:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy tùy chọn món ăn",
      });
    }
  }
);

router.put(
  "/foods/:id/options",
  requireAdmin,
  requirePermission("food.edit"),
  async (req, res) => {
    try {
      const { groups } = req.body;

      if (!Array.isArray(groups)) {
        return res.status(400).json({
          success: false,
          message: "Danh sách nhóm tùy chọn không hợp lệ",
        });
      }

      const data = await saveAdminFoodOptions(
        String(req.params.id),
        groups
      );

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy món ăn",
        });
      }

      return res.json({
        success: true,
        message: "Cập nhật tùy chọn món ăn thành công",
        data,
      });
    } catch (error) {
      console.error("Lỗi cập nhật tùy chọn món ăn:", error);

      return res.status(400).json({
        success: false,
        message: "Không thể cập nhật tùy chọn món ăn",
      });
    }
  }
);

router.get(
  "/foods",
  requireAdmin,
  requirePermission("food.view"),
  async (req, res) => {
    try {
      const data = await getAdminFoods(
        typeof req.query.search === "string" ? req.query.search : undefined
      );
      return res.json({ success: true, data });
    } catch (error) {
      console.error("Lỗi lấy danh sách món ăn:", error);
      return res.status(500).json({ success: false, message: "Không thể lấy danh sách món ăn" });
    }
  }
);

router.get(
  "/food-categories",
  requireAdmin,
  requirePermission("food.view"),
  async (_req, res) => {
    try {
      const data = await getAdminFoodCategories();
      return res.json({ success: true, data });
    } catch (error) {
      console.error("Lỗi lấy danh mục:", error);
      return res.status(500).json({ success: false, message: "Không thể lấy danh mục" });
    }
  }
);

router.post(
  "/foods",
  requireAdmin,
  requirePermission("food.create"),
  uploadMenuImage.single("image"),
  async (req, res) => {
    try {
      const { category_id, name, price, description, sale_price } = req.body;

      if (!category_id || !name?.trim() || !Number.isFinite(Number(price)) || Number(price) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập danh mục, tên món và giá hợp lệ",
        });
      }

      const imageUrl = req.file
        ? `/uploads/menu/${req.file.filename}`
        : null;

      const data = await createAdminFood({
        category_id,
        name,
        price: Number(price),
        description,
        sale_price: sale_price === "" || sale_price == null ? null : Number(sale_price),
        image_url: imageUrl,
      });

      return res.status(201).json({
        success: true,
        message: "Thêm món ăn thành công",
        data,
      });
    } catch (error) {
      console.error("Lỗi thêm món ăn:", error);
      return res.status(500).json({ success: false, message: "Không thể thêm món ăn" });
    }
  }
);

router.put(
  "/foods/:id",
  requireAdmin,
  requirePermission("food.edit"),
  uploadMenuImage.single("image"),
  async (req, res) => {
    try {
      const { category_id, name, price, description, sale_price } = req.body;

      const data = await updateAdminFood(String(req.params.id), {
        category_id: category_id || undefined,
        name: name || undefined,
        price: price === undefined || price === "" ? undefined : Number(price),
        description,
        sale_price: sale_price === undefined
          ? undefined
          : sale_price === "" ? null : Number(sale_price),
        image_url: req.file
          ? `/uploads/menu/${req.file.filename}`
          : undefined,
      });

      if (!data) {
        return res.status(404).json({ success: false, message: "Không tìm thấy món ăn" });
      }

      return res.json({ success: true, message: "Cập nhật món ăn thành công", data });
    } catch (error) {
      console.error("Lỗi cập nhật món ăn:", error);
      return res.status(500).json({ success: false, message: "Không thể cập nhật món ăn" });
    }
  }
);

router.patch(
  "/foods/:id/status",
  requireAdmin,
  requirePermission("food.edit"),
  async (req, res) => {
    try {
      const status = req.body.status;

      if (status !== "available" && status !== "unavailable") {
        return res.status(400).json({
          success: false,
          message: "Trạng thái không hợp lệ",
        });
      }

      const data = await updateAdminFoodStatus(String(req.params.id), status);

      if (!data) {
        return res.status(404).json({ success: false, message: "Không tìm thấy món ăn" });
      }

      return res.json({ success: true, message: "Cập nhật trạng thái thành công", data });
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái món ăn:", error);
      return res.status(500).json({ success: false, message: "Không thể cập nhật trạng thái" });
    }
  }
);

router.delete(
  "/foods/:id",
  requireAdmin,
  requirePermission("food.delete"),
  async (req, res) => {
    try {
      const data = await deleteAdminFood(String(req.params.id));

      if (!data) {
        return res.status(404).json({ success: false, message: "Không tìm thấy món ăn" });
      }

      return res.json({ success: true, message: "Đã xóa món ăn" });
    } catch (error) {
      console.error("Lỗi xóa món ăn:", error);
      return res.status(500).json({ success: false, message: "Không thể xóa món ăn" });
    }
  }
);

// ===============================
// ADMIN STAFF MANAGEMENT
// ===============================


router.get(
  "/staff",
  requireAdmin,
  requirePermission("staff.view"),
  getAdminStaffController
);

router.post(
  "/staff",
  requireAdmin,
  requirePermission("staff.create"),
  createAdminStaffController
);

router.get(
  "/staff/roles",
  requireAdmin,
  requirePermission("staff.roles.view"),
  getAdminStaffRolesController
);

router.patch(
  "/staff/:id/role",
  requireAdmin,
  requirePermission("staff.role.edit"),
  updateAdminStaffRoleController
);

router.patch(
  "/staff/:id/status",
  requireAdmin,
  requirePermission("staff.status.edit"),
  updateAdminStaffStatusController
);

router.get(
  "/staff/activity-logs",
  requireAdmin,
  requirePermission("staff.activity.view"),
  getAdminStaffActivityLogsController
);

// ===============================
// ADMIN BANNER MANAGEMENT
// ===============================

router.get(
  "/banners",
  requireAdmin,
  requirePermission("banner.view"),
  getAdminBannersController
);

router.post(
  "/banners",
  requireAdmin,
  requirePermission("banner.create"),
  createAdminBannerController
);

router.patch(
  "/banners/:id",
  requireAdmin,
  requirePermission("banner.edit"),
  updateAdminBannerController
);

router.patch(
  "/banners/:id/status",
  requireAdmin,
  requirePermission("banner.edit"),
  updateAdminBannerStatusController
);

router.delete(
  "/banners/:id",
  requireAdmin,
  requirePermission("banner.delete"),
  deleteAdminBannerController
);

router.post(
  "/banners/upload",
  requireAdmin,
  requirePermission("banner.create"),
  uploadBannerImage.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn ảnh Banner",
        });
      }

      return res.status(201).json({
        success: true,
        message: "Tải ảnh Banner thành công",
        data: {
          image_url: `/uploads/banners/${req.file.filename}`,
        },
      });
    } catch (error) {
      console.error("Lỗi tải ảnh Banner:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể tải ảnh Banner",
      });
    }
  }
);


// ===============================
// ADMIN VOUCHER MANAGEMENT
// ===============================

router.get(
  "/vouchers",
  requireAdmin,
  requirePermission("voucher.view"),
  getAdminVouchersController
);

router.get(
  "/vouchers/:id",
  requireAdmin,
  requirePermission("voucher.view"),
  getAdminVoucherDetailController
);

router.post(
  "/vouchers",
  requireAdmin,
  requirePermission("voucher.create"),
  createAdminVoucherController
);

router.patch(
  "/vouchers/:id",
  requireAdmin,
  requirePermission("voucher.edit"),
  updateAdminVoucherController
);

router.patch(
  "/vouchers/:id/status",
  requireAdmin,
  requirePermission("voucher.edit"),
  updateAdminVoucherStatusController
);

router.delete(
  "/vouchers/:id",
  requireAdmin,
  requirePermission("voucher.delete"),
  deleteAdminVoucherController
);




// ===== GIẢM GIÁ ĐƠN & GIÁM SÁT NHÂN VIÊN =====

router.post(
  "/orders/:id/discount",
  requireAdmin,
  requirePermission("order.discount"),
  async (req: AdminRequest, res: Response) => {
    try {
      const data = await applyManualDiscount({
        orderId: String(req.params.id),
        adminUserId: req.admin!.userId,
        roles: req.admin?.roles ?? [],
        amount: req.body?.amount,
        reason: req.body?.reason,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error instanceof AuditError) {
        const status =
          error.code === "NOT_FOUND" ? 404
          : error.code === "INVALID_STATE" ? 409
          : error.code === "OVER_LIMIT" ? 403
          : 400;
        return res.status(status).json({ success: false, code: error.code, message: error.message });
      }
      console.error("POST /orders/:id/discount failed:", error);
      return res.status(500).json({ success: false, message: "Không thể giảm giá đơn hàng" });
    }
  }
);

router.get(
  "/staff-audit/summary",
  requireAdmin,
  requirePermission("staff.audit.view"),
  async (req: AdminRequest, res: Response) => {
    try {
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      return res.json({ success: true, data: await getStaffActivitySummary(from, to) });
    } catch (error) {
      console.error("GET /staff-audit/summary failed:", error);
      return res.status(500).json({ success: false, message: "Không thể tải thống kê nhân viên" });
    }
  }
);

router.get(
  "/staff-audit/events",
  requireAdmin,
  requirePermission("staff.audit.view"),
  async (req: AdminRequest, res: Response) => {
    try {
      const q = (k: string) => (typeof req.query[k] === "string" ? (req.query[k] as string) : undefined);
      return res.json({
        success: true,
        data: await getStaffActivityEvents({
          type: q("type"),
          staffId: q("staffId"),
          from: q("from"),
          to: q("to"),
          limit: Number(req.query.limit),
        }),
      });
    } catch (error) {
      console.error("GET /staff-audit/events failed:", error);
      return res.status(500).json({ success: false, message: "Không thể tải nhật ký thao tác" });
    }
  }
);

export default router;


