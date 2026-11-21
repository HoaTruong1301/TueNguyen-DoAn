
import { Request, Response } from "express";
import * as promotionService from "./promotion.service";

export async function getActiveVouchers(
  req: Request,
  res: Response
) {
  try {
    const pageRaw = req.query.page;
    const limitRaw = req.query.limit;

    const page = pageRaw === undefined ? 1 : Number(pageRaw);
    const limit = limitRaw === undefined ? 20 : Number(limitRaw);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "page phải >= 1; limit phải từ 1 đến 100",
      });
    }

    const result = await promotionService.getActiveVouchers(
      page,
      limit
    );

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách khuyến mãi",
    });
  }
}

export async function getVoucherById(
  req: Request,
  res: Response
) {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: "ID voucher không hợp lệ",
      });
    }

    const voucher = await promotionService.getVoucherById(id);

    return res.status(200).json({
      success: true,
      data: voucher,
    });
  } catch (error: any) {
    if (error.message === "VOUCHER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khuyến mãi",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy chi tiết khuyến mãi",
    });
  }
}


export async function validateVoucher(
  req: Request,
  res: Response
) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập",
      });
    }

    const { voucherCode, items } = req.body;

    if (
      typeof voucherCode !== "string" ||
      !voucherCode.trim() ||
      voucherCode.length > 50 ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Thông tin kiểm tra Voucher không hợp lệ",
      });
    }

    for (const item of items) {
      if (
        typeof item.foodId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.foodId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        return res.status(400).json({
          success: false,
          message: "Danh sách món ăn không hợp lệ",
        });
      }
    }

    const result = await promotionService.validateVoucher(
      userId,
      voucherCode,
      items
    );

    return res.status(200).json({
      success: true,
      message: "Áp dụng Voucher thành công",
      data: result,
    });
  } catch (error: any) {
    const errors: Record<string, [number, string]> = {
      VOUCHER_NOT_FOUND: [404, "Không tìm thấy mã Voucher"],
      VOUCHER_INACTIVE: [400, "Voucher hiện không hoạt động"],
      VOUCHER_NOT_STARTED: [400, "Voucher chưa đến thời gian sử dụng"],
      VOUCHER_EXPIRED: [400, "Voucher đã hết hạn"],
      VOUCHER_USAGE_LIMIT_REACHED: [400, "Voucher đã hết lượt sử dụng"],
      VOUCHER_USER_LIMIT_REACHED: [400, "Bạn đã sử dụng hết lượt Voucher này"],
      VOUCHER_MIN_ORDER_NOT_MET: [400, "Đơn hàng chưa đạt giá trị tối thiểu để sử dụng Voucher"],
      VOUCHER_NOT_APPLICABLE: [400, "Voucher không áp dụng cho các món ăn trong đơn hàng"],
      VOUCHER_NO_DISCOUNT: [400, "Voucher không tạo ra giá trị giảm giá hợp lệ"],
      VOUCHER_INVALID_DISCOUNT_TYPE: [400, "Loại giảm giá của Voucher không hợp lệ"],
    };

    const errorCode = error instanceof Error ? error.message : "";

    if (errors[errorCode]) {
      const [status, message] = errors[errorCode];

      return res.status(status).json({
        success: false,
        message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không thể kiểm tra Voucher",
    });
  }
}


export async function getMyVoucherHistory(
  req: Request,
  res: Response
) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập"
      });
    }

    const page = req.query.page === undefined
      ? 1
      : Number(req.query.page);

    const limit = req.query.limit === undefined
      ? 20
      : Number(req.query.limit);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "page hoặc limit không hợp lệ"
      });
    }

    const result = await promotionService.getMyVoucherHistory(
      userId,
      page,
      limit
    );

    return res.json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    console.error("Get voucher history error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải lịch sử sử dụng Voucher"
    });
  }
}


