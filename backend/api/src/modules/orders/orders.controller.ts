
import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { z } from "zod";
import {
  createOrder as createOrderService,
  getMyOrders as getMyOrdersService,
  getOrderDetail,
  cancelOrder as cancelOrderService
} from "./orders.service";

const createOrderSchema = z.object({
  orderType: z.enum(["delivery", "pickup", "dine_in"]),
  addressId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
  voucherCode: z.string().trim().max(50).optional(),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "e_wallet"]),
  items: z.array(
    z.object({
      foodId: z.string().uuid(),
      quantity: z.number().int().min(1).max(99),
      note: z.string().max(500).optional(),
      options: z.array(
        z.object({
          optionId: z.string().uuid(),
          quantity: z.number().int().min(1).max(20).optional()
        })
      ).max(20).optional()
    })
  ).min(1).max(50)
});

function getUserId(req: AuthRequest, res: Response) {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      message: "Vui lòng đăng nhập"
    });
    return null;
  }

  return req.user.id;
}


function sendOrderError(error: unknown, res: Response) {
  const code = error instanceof Error ? error.message : "";

  const errors: Record<string, [number, string]> = {
    USER_NOT_FOUND: [404, "Không tìm thấy tài khoản"],
    CUSTOMER_INFO_REQUIRED: [400, "Vui lòng cập nhật họ tên và số điện thoại"],
    DELIVERY_ADDRESS_REQUIRED: [400, "Vui lòng chọn địa chỉ giao hàng"],
    ADDRESS_NOT_FOUND: [404, "Không tìm thấy địa chỉ của bạn"],
    FOOD_NOT_AVAILABLE: [400, "Một món ăn không còn khả dụng"],
    FOOD_OPTION_NOT_AVAILABLE: [400, "Một tùy chọn món ăn không còn khả dụng"],
    ORDER_NOT_FOUND: [404, "Không tìm thấy đơn hàng"],
    ORDER_CANNOT_BE_CANCELLED: [400, "Chỉ có thể hủy đơn đang chờ xác nhận"],

    VOUCHER_NOT_FOUND: [404, "Không tìm thấy mã Voucher"],
    VOUCHER_INACTIVE: [400, "Voucher hiện không hoạt động"],
    VOUCHER_NOT_STARTED: [400, "Voucher chưa đến thời gian sử dụng"],
    VOUCHER_EXPIRED: [400, "Voucher đã hết hạn"],
    VOUCHER_USAGE_LIMIT_REACHED: [400, "Voucher đã hết lượt sử dụng"],
    VOUCHER_USER_LIMIT_REACHED: [400, "Bạn đã sử dụng hết lượt Voucher này"],
    VOUCHER_MIN_ORDER_NOT_MET: [400, "Đơn hàng chưa đạt giá trị tối thiểu để sử dụng Voucher"],
    VOUCHER_NOT_APPLICABLE: [400, "Voucher không áp dụng cho các món ăn trong đơn hàng"],
    VOUCHER_NO_DISCOUNT: [400, "Voucher không tạo ra giá trị giảm giá hợp lệ"],
    VOUCHER_INVALID_DISCOUNT_TYPE: [400, "Loại giảm giá của Voucher không hợp lệ"]
  };

  const mapped = errors[code];

  if (mapped) {
    return res.status(mapped[0]).json({
      success: false,
      message: mapped[1]
    });
  }

  console.error("Order API error:", error);

  return res.status(500).json({
    success: false,
    message: "Đã xảy ra lỗi khi xử lý đơn hàng"
  });
}


export async function createOrder(req: AuthRequest, res: Response) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu đơn hàng không hợp lệ",
      errors: parsed.error.flatten()
    });
  }

  try {
    const order = await createOrderService(userId, parsed.data);

    return res.status(201).json({
      success: true,
      message: "Tạo đơn hàng thành công",
      data: order
    });
  } catch (error) {
    return sendOrderError(error, res);
  }
}

export async function getMyOrders(req: AuthRequest, res: Response) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);

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

  try {
    const orders = await getMyOrdersService(userId, page, limit);

    return res.json({
      success: true,
      data: orders,
      pagination: { page, limit }
    });
  } catch (error) {
    return sendOrderError(error, res);
  }
}

export async function getMyOrderDetail(
  req: AuthRequest,
  res: Response
) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const orderId = req.params.id;

  if (typeof orderId !== "string" || !z.string().uuid().safeParse(orderId).success) {
    return res.status(400).json({
      success: false,
      message: "ID đơn hàng không hợp lệ"
    });
  }

  try {
    const order = await getOrderDetail(userId, orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng"
      });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    return sendOrderError(error, res);
  }
}

export async function cancelOrder(req: AuthRequest, res: Response) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const orderId = req.params.id;

  if (typeof orderId !== "string" || !z.string().uuid().safeParse(orderId).success) {
    return res.status(400).json({
      success: false,
      message: "ID đơn hàng không hợp lệ"
    });
  }

  const parsed = z.object({
    reason: z.string().max(500).optional()
  }).safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Lý do hủy không hợp lệ"
    });
  }

  try {
    const result = await cancelOrderService(
      userId,
      orderId,
      parsed.data.reason
    );

    return res.json({
      success: true,
      message: "Đã hủy đơn hàng",
      data: result
    });
  } catch (error) {
    return sendOrderError(error, res);
  }
}
