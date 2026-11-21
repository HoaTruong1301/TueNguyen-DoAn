
import { Request, Response } from "express";
import { updateAdminMemberProfile } from "./admin-member-profile.service";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateAdminMemberProfileController(
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

    const result = await updateAdminMemberProfile(
      userId,
      req.body
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khách hàng",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật hồ sơ khách hàng thành công",
      data: result,
    });
  } catch (error) {
    console.error(
      "Update admin member profile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật hồ sơ khách hàng",
    });
  }
}
