
import { Request, Response } from "express";
import {
  getAdminBanners,
  createAdminBanner,
  updateAdminBanner,
  updateAdminBannerStatus,
  deleteAdminBanner,
  AdminBannerInput,
} from "./admin-banner.service";
import { AdminRequest } from "../../middleware/admin.middleware";

export async function getAdminBannersController(
  _req: Request,
  res: Response
) {
  try {
    const data = await getAdminBanners();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get admin banners error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách banner",
    });
  }
}

export async function createAdminBannerController(
  req: AdminRequest,
  res: Response
) {
  try {
    const data = req.body as AdminBannerInput;

    if (!data.title?.trim() || !data.image_url?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tiêu đề và đường dẫn ảnh là bắt buộc",
      });
    }

    const banner = await createAdminBanner(
      data,
      req.admin?.userId
    );

    return res.status(201).json({
      success: true,
      message: "Tạo banner thành công",
      data: banner,
    });
  } catch (error) {
    console.error("Create admin banner error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tạo banner",
    });
  }
}

export async function updateAdminBannerController(
  req: AdminRequest,
  res: Response
) {
  try {
    const data = req.body as AdminBannerInput;

    if (!data.title?.trim() || !data.image_url?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tiêu đề và đường dẫn ảnh là bắt buộc",
      });
    }

    const banner = await updateAdminBanner(
      String(req.params.id),
      data,
      req.admin?.userId
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy banner",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật banner thành công",
      data: banner,
    });
  } catch (error) {
    console.error("Update admin banner error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật banner",
    });
  }
}

export async function updateAdminBannerStatusController(
  req: AdminRequest,
  res: Response
) {
  try {
    const isActive = req.body.is_active;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Trạng thái banner không hợp lệ",
      });
    }

    const banner = await updateAdminBannerStatus(
      String(req.params.id),
      isActive,
      req.admin?.userId
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy banner",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái banner thành công",
      data: banner,
    });
  } catch (error) {
    console.error("Update admin banner status error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật trạng thái banner",
    });
  }
}

export async function deleteAdminBannerController(
  req: Request,
  res: Response
) {
  try {
    const banner = await deleteAdminBanner(
      String(req.params.id)
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy banner",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Xóa banner thành công",
    });
  } catch (error) {
    console.error("Delete admin banner error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể xóa banner",
    });
  }
}
