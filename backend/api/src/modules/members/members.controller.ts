import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as membersService from "./members.service";

export async function getMyProfile(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const profile = await membersService.getMyProfile(
      req.user.id
    );

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    if (error.message === "PROFILE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Chưa có thông tin hồ sơ",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function updateMyProfile(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const {
      fullName,
      phoneNumber,
      avatarUrl,
      dateOfBirth,
      gender,
    } = req.body;

    if (fullName !== undefined && fullName.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Họ tên quá dài",
      });
    }

    if (
      phoneNumber !== undefined &&
      phoneNumber !== null &&
      phoneNumber.length > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại không hợp lệ",
      });
    }

    const profile =
      await membersService.createOrUpdateMyProfile(
        req.user.id,
        {
          fullName,
          phoneNumber,
          avatarUrl,
          dateOfBirth,
          gender,
        }
      );

    return res.status(200).json({
      success: true,
      data: profile,
      message: "Cập nhật hồ sơ thành công",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function getMyAddresses(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const addresses =
      await membersService.getMyAddresses(req.user.id);

    return res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function createAddress(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const {
      recipientName,
      phone,
      addressLine,
      ward,
      district,
      province,
      latitude,
      longitude,
      isDefault,
    } = req.body;

    if (!recipientName || !phone || !addressLine) {
      return res.status(400).json({
        success: false,
        message:
          "recipientName, phone và addressLine là bắt buộc",
      });
    }

    const address =
      await membersService.createAddress(
        req.user.id,
        {
          recipientName,
          phone,
          addressLine,
          ward,
          district,
          province,
          latitude,
          longitude,
          isDefault,
        }
      );

    return res.status(201).json({
      success: true,
      data: address,
      message: "Thêm địa chỉ thành công",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function updateAddress(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const addressId = req.params.id;

    if (typeof addressId !== "string" || !addressId.trim()) {
      return res.status(400).json({
        success: false,
        message: "ID địa chỉ không hợp lệ",
      });
    }

    const address =
        await membersService.updateAddress(
            req.user.id,
            addressId,
            req.body
        );

    return res.status(200).json({
      success: true,
      data: address,
      message: "Cập nhật địa chỉ thành công",
    });
  } catch (error: any) {
    if (error.message === "ADDRESS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function setDefaultAddress(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const addressId = req.params.id;

    if (typeof addressId !== "string" || !addressId.trim()) {
      return res.status(400).json({
        success: false,
        message: "ID địa chỉ không hợp lệ",
      });
    }

    const address =
        await membersService.setDefaultAddress(
            req.user.id,
            addressId
        );

    return res.status(200).json({
      success: true,
      data: address,
      message: "Đã đặt địa chỉ mặc định",
    });
  } catch (error: any) {
    if (error.message === "ADDRESS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}

export async function deleteAddress(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const addressId = req.params.id;

    if (typeof addressId !== "string" || !addressId.trim()) {
      return res.status(400).json({
        success: false,
        message: "ID địa chỉ không hợp lệ",
      });
    }

    const result =
        await membersService.deleteAddress(
            req.user.id,
            addressId
        );

    return res.status(200).json({
      success: true,
      data: result,
      message: "Xóa địa chỉ thành công",
    });
  } catch (error: any) {
    if (error.message === "ADDRESS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
}