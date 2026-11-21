
import { Request, Response } from "express";
import { getAdminMemberDetail } from "./admin-member-detail.service";

export async function getAdminMemberDetailController(
  req: Request,
  res: Response
) {
  try {
    const userId = req.params.id;

    // Kiểm tra ID có tồn tại và đúng kiểu chuỗi
    if (typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        message: "ID khách hàng không hợp lệ",
      });
    }

    // Kiểm tra định dạng UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(userId)) {
      return res.status(400).json({
        success: false,
        message: "ID khách hàng không hợp lệ",
      });
    }

    const result = await getAdminMemberDetail(userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khách hàng",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin chi tiết khách hàng thành công",
      data: result,
    });
  } catch (error) {
    console.error("Get admin member detail error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin chi tiết khách hàng",
    });
  }
}
