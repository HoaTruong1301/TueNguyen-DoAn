import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
  getMyDeliveryOrders,
  getMyDeliveryDetail,
  getMyDeliveryTracking,
  getAdminDeliveryOrders,
  assignDelivery,
  updateDeliveryStatus,
  updateDeliveryLocation,
  DeliveryStatus
} from "./delivery.service";
function getUserId(req: Request): string {
  return (req as AuthRequest).user!.id;
}

function getAdminUserId(req: Request): string {
  return (req as any).admin.userId;
}

function getOrderId(req: Request): string {
  const value = req.params.orderId;

  if (typeof value !== "string" || !value.trim()) {
    throw new Error("INVALID_ORDER_ID");
  }

  return value;
}

function getPagination(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  return { page, limit };
}

export async function getMyDeliveryOrdersController(
  req: Request,
  res: Response
) {
  const { page, limit } = getPagination(req);

  const data = await getMyDeliveryOrders(
    getUserId(req),
    page,
    limit
  );

  return res.json({ success: true, ...data });
}

export async function getMyDeliveryDetailController(
  req: Request,
  res: Response
) {
  const data = await getMyDeliveryDetail(
    getUserId(req),
    getOrderId(req)
  );

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy thông tin giao hàng."
    });
  }

  return res.json({ success: true, data });
}

export async function getMyDeliveryTrackingController(
  req: Request,
  res: Response
) {
  const data = await getMyDeliveryTracking(
    getUserId(req),
    getOrderId(req)
  );

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy thông tin giao hàng."
    });
  }

  return res.json({ success: true, data });
}

export async function getAdminDeliveryOrdersController(
  req: Request,
  res: Response
) {
  const { page, limit } = getPagination(req);

  const status = req.query.status
    ? String(req.query.status) as DeliveryStatus
    : undefined;

  const validStatuses: DeliveryStatus[] = [
    "pending",
    "assigned",
    "picked_up",
    "out_for_delivery",
    "delivered",
    "failed",
    "cancelled"
  ];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Trạng thái giao hàng không hợp lệ."
    });
  }

  const data = await getAdminDeliveryOrders(
    page,
    limit,
    status
  );

  return res.json({ success: true, ...data });
}

export async function assignDeliveryController(
  req: Request,
  res: Response
) {
  const driverName = String(req.body.driverName ?? "");
  const driverPhone = String(req.body.driverPhone ?? "");

  if (!driverName.trim() || !driverPhone.trim()) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập tên và số điện thoại người giao hàng."
    });
  }

  const data = await assignDelivery(
    getOrderId(req),
    driverName,
    driverPhone,
    getAdminUserId(req)
  );

  return res.json({
    success: true,
    message: "Đã phân công người giao hàng.",
    data
  });
}

export async function updateDeliveryStatusController(
  req: Request,
  res: Response
) {
  const validStatuses: DeliveryStatus[] = [
    "pending",
    "assigned",
    "picked_up",
    "out_for_delivery",
    "delivered",
    "failed",
    "cancelled"
  ];

  const status = String(req.body.status ?? "") as DeliveryStatus;
  const note = req.body.note
    ? String(req.body.note)
    : undefined;

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Trạng thái giao hàng không hợp lệ."
    });
  }

  const data = await updateDeliveryStatus(
    getOrderId(req),
    status,
    getAdminUserId(req),
    note
  );

  return res.json({
    success: true,
    message: "Đã cập nhật trạng thái giao hàng.",
    data
  });
}

// Admin cập nhật vị trí người giao hàng trên bản đồ.
export async function updateDeliveryLocationController(
  req: Request,
  res: Response
) {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);

  if (
    req.body.latitude === undefined ||
    req.body.longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res.status(400).json({
      success: false,
      message: "Tọa độ GPS không hợp lệ."
    });
  }

  const data = await updateDeliveryLocation(
    getOrderId(req),
    latitude,
    longitude
  );

  return res.json({
    success: true,
    message: "Đã cập nhật vị trí người giao hàng.",
    data
  });
}