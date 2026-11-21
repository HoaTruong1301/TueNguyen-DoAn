
import { Request, Response } from "express";
import {
  blockAdminMember,
  unblockAdminMember,
} from "./admin-member-block.service";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function blockAdminMemberController(
  req: Request,
  res: Response
) {
  try {
    const userId = req.params.id;

    if (
      typeof userId !== "string" ||
      !uuidRegex.test(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "ID khách hàng không hợp lệ",
      });
    }

    const result = await blockAdminMember(userId);

    if (result.notFound) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khách hàng",
      });
    }

    if (result.alreadyBlocked) {
      return res.status(409).json({
        success: false,
        message: "Tài khoản đã bị khóa",
      });
    }

    if ("invalidStatus" in result) {
      return res.status(409).json({
        success: false,
        message: "Không thể khóa tài khoản ở trạng thái hiện tại",
        currentStatus: result.invalidStatus,
      });
    }

    return res.status(200).json({
        success: true,
        message: "Khóa tài khoản khách hàng thành công",
        data: result.data,
        revokedSessions: result.revokedSessions,
        });
  } catch (error) {
    console.error("Block admin member error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể khóa tài khoản khách hàng",
    });
  }
}

export async function unblockAdminMemberController(
  req: Request,
  res: Response
) {
  try {
    const userId = req.params.id;

    if (
      typeof userId !== "string" ||
      !uuidRegex.test(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "ID khách hàng không hợp lệ",
      });
    }

    const result = await unblockAdminMember(userId);

    if (result.notFound) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khách hàng",
      });
    }

    if (result.alreadyActive) {
      return res.status(409).json({
        success: false,
        message: "Tài khoản đang hoạt động",
      });
    }

    if ("invalidStatus" in result) {
      return res.status(409).json({
        success: false,
        message: "Không thể mở khóa tài khoản ở trạng thái hiện tại",
        currentStatus: result.invalidStatus,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mở khóa tài khoản khách hàng thành công",
      data: result.data,
    });
  } catch (error) {
    console.error("Unblock admin member error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể mở khóa tài khoản khách hàng",
    });
  }
}
