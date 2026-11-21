
import { Request, Response } from "express";
import * as voucherService from "./admin-voucher.service";

export async function getAdminVouchersController(
  req: Request,
  res: Response
) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "Tham số phân trang không hợp lệ.",
      });
    }

    const status = req.query.status as
      | "all"
      | "active"
      | "inactive"
      | "upcoming"
      | "expired"
      | undefined;

    if (
      status &&
      !["all", "active", "inactive", "upcoming", "expired"].includes(status)
    ) {
      return res.status(400).json({
        message: "Trạng thái Voucher không hợp lệ.",
      });
    }

    const result = await voucherService.getAdminVouchers({
      page,
      limit,
      status,
      search:
        typeof req.query.search === "string"
          ? req.query.search
          : undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("getAdminVouchersController:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách Voucher.",
    });
  }
}

export async function getAdminVoucherDetailController(
  req: Request,
  res: Response
) {
  try {
    const voucher = await voucherService.getAdminVoucherById(
      String(req.params.id)
    );

    if (!voucher) {
      return res.status(404).json({
        message: "Không tìm thấy Voucher.",
      });
    }

    return res.json(voucher);
  } catch (error) {
    console.error("getAdminVoucherDetailController:", error);

    return res.status(500).json({
      message: "Không thể lấy thông tin Voucher.",
    });
  }
}

export async function createAdminVoucherController(
  req: Request,
  res: Response
) {
  try {
    const voucher = await voucherService.createAdminVoucher(req.body);

    return res.status(201).json({
      message: "Tạo Voucher thành công.",
      data: voucher,
    });
  } catch (error) {
    console.error("createAdminVoucherController:", error);

    const message =
      error instanceof Error ? error.message : "";

    if (
      [
        "VOUCHER_CODE_REQUIRED",
        "VOUCHER_NAME_REQUIRED",
        "INVALID_DISCOUNT_TYPE",
        "INVALID_DISCOUNT_VALUE",
        "INVALID_PERCENTAGE",
        "INVALID_MIN_ORDER_AMOUNT",
        "INVALID_MAX_DISCOUNT_AMOUNT",
        "INVALID_USAGE_LIMIT",
        "INVALID_PER_USER_LIMIT",
        "INVALID_VOUCHER_TIME",
      ].includes(message)
    ) {
      return res.status(400).json({
        message: "Thông tin Voucher không hợp lệ.",
        error: message,
      });
    }

    if (
      message.includes("duplicate key") ||
      message.includes("vouchers_code_key")
    ) {
      return res.status(409).json({
        message: "Mã Voucher đã tồn tại.",
      });
    }

    return res.status(500).json({
      message: "Không thể tạo Voucher.",
    });
  }
}

export async function updateAdminVoucherController(
  req: Request,
  res: Response
) {
  try {
    const voucher = await voucherService.updateAdminVoucher(
      String(req.params.id),
      req.body
    );

    if (!voucher) {
      return res.status(404).json({
        message: "Không tìm thấy Voucher.",
      });
    }

    return res.json({
      message: "Cập nhật Voucher thành công.",
      data: voucher,
    });
  } catch (error) {
    console.error("updateAdminVoucherController:", error);

    const message =
      error instanceof Error ? error.message : "";

    if (
      [
        "VOUCHER_CODE_REQUIRED",
        "VOUCHER_NAME_REQUIRED",
        "INVALID_DISCOUNT_TYPE",
        "INVALID_DISCOUNT_VALUE",
        "INVALID_PERCENTAGE",
        "INVALID_MIN_ORDER_AMOUNT",
        "INVALID_MAX_DISCOUNT_AMOUNT",
        "INVALID_USAGE_LIMIT",
        "INVALID_PER_USER_LIMIT",
        "INVALID_VOUCHER_TIME",
      ].includes(message)
    ) {
      return res.status(400).json({
        message: "Thông tin Voucher không hợp lệ.",
        error: message,
      });
    }

    if (
      message.includes("duplicate key") ||
      message.includes("vouchers_code_key")
    ) {
      return res.status(409).json({
        message: "Mã Voucher đã tồn tại.",
      });
    }

    return res.status(500).json({
      message: "Không thể cập nhật Voucher.",
    });
  }
}

export async function updateAdminVoucherStatusController(
  req: Request,
  res: Response
) {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      return res.status(400).json({
        message: "is_active phải là true hoặc false.",
      });
    }

    const voucher = await voucherService.updateAdminVoucherStatus(
      String(req.params.id),
      is_active
    );

    if (!voucher) {
      return res.status(404).json({
        message: "Không tìm thấy Voucher.",
      });
    }

    return res.json({
      message: "Cập nhật trạng thái Voucher thành công.",
      data: voucher,
    });
  } catch (error) {
    console.error("updateAdminVoucherStatusController:", error);

    return res.status(500).json({
      message: "Không thể cập nhật trạng thái Voucher.",
    });
  }
}

export async function deleteAdminVoucherController(
  req: Request,
  res: Response
) {
  try {
    const result = await voucherService.deleteAdminVoucher(
      String(req.params.id)
    );

    if (!result) {
      return res.status(404).json({
        message: "Không tìm thấy Voucher.",
      });
    }

    return res.json({
      message: "Xóa Voucher thành công.",
    });
  } catch (error) {
    console.error("deleteAdminVoucherController:", error);

    const message =
      error instanceof Error ? error.message : "";

    if (message === "VOUCHER_HAS_USAGE_HISTORY") {
      return res.status(409).json({
        message:
          "Voucher đã có lịch sử sử dụng nên không thể xóa.",
      });
    }

    return res.status(500).json({
      message: "Không thể xóa Voucher.",
    });
  }
}
