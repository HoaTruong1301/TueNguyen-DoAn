
import { Request, Response } from "express";
import {
  createAdminStaff,
  getAdminStaff,
  getAdminStaffRoles,
  updateAdminStaffRole,
  updateAdminStaffStatus,
  getAdminStaffActivityLogs,
} from "./admin-staff.service";
import { AdminRequest } from "../../middleware/admin.middleware";

export async function getAdminStaffController(
  req: AdminRequest,
  res: Response
) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || "");

    const data = await getAdminStaff(
      req.admin!.roles,
      page,
      limit,
      search
    );

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("GET_ADMIN_STAFF_ERROR:", error);

    return res.status(
      error.message === "SUPER_ADMIN_REQUIRED" ? 403 : 500
    ).json({
      success: false,
      message: error.message === "SUPER_ADMIN_REQUIRED"
        ? "Chỉ SUPER_ADMIN được quản lý nhân viên"
        : "Không thể lấy danh sách nhân viên",
    });
  }
}

export async function createAdminStaffController(
  req: AdminRequest,
  res: Response
) {
  try {
    const { email, phone, fullName, password, roleCode } = req.body;

    if (
        !email ||
        typeof email !== "string" ||
        !email.trim() ||
        !phone ||
        typeof phone !== "string" ||
        !phone.trim() ||
        !fullName ||
        typeof fullName !== "string" ||
        !fullName.trim() ||
        !password ||
        !roleCode
        ) {
        return res.status(400).json({
            success: false,
            message: "Vui lòng nhập đầy đủ thông tin nhân viên",
        });
        }

    if (
      typeof email !== "string" ||
      typeof fullName !== "string" ||
      typeof password !== "string" ||
      typeof roleCode !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
      });
    }

    const normalizedRoleCode = roleCode.trim().toUpperCase();

    if (!normalizedRoleCode) {
    return res.status(400).json({
        success: false,
        message: "Vui lòng chọn vai trò hợp lệ",
    });
    }

    const normalizedFullName = fullName.trim();

    if (
    normalizedFullName.length < 2 ||
    normalizedFullName.length > 100
    ) {
    return res.status(400).json({
        success: false,
        message: "Họ tên phải từ 2 đến 100 ký tự",
    });
    }

    const normalizedPhone = phone.trim();

    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({
        success: false,
        message: "Email không đúng định dạng",
    });
    }

    if (!/^(0[35789]\d{8}|\+84[35789]\d{8})$/.test(normalizedPhone)) {
        return res.status(400).json({
            success: false,
            message: "Số điện thoại không đúng định dạng",
        });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải từ 8 đến 72 ký tự",
      });
    }

    const data = await createAdminStaff(
      {
        email: normalizedEmail,
        phone: normalizedPhone,
        fullName: normalizedFullName,
        password,
        roleCode: normalizedRoleCode,
      },
      {
        adminId: req.admin!.id,
        roles: req.admin!.roles,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      }
    );

    return res.status(201).json({
      success: true,
      message: "Tạo tài khoản nhân viên thành công",
      data,
    });
  } catch (error: any) {
    console.error("CREATE_ADMIN_STAFF_ERROR:", error);

    const errors: Record<string, string> = {
      SUPER_ADMIN_REQUIRED: "Chỉ SUPER_ADMIN được tạo nhân viên",
      CANNOT_CREATE_SUPER_ADMIN: "Không thể tạo SUPER_ADMIN từ chức năng này",
      ROLE_NOT_FOUND: "Vai trò không tồn tại",
      EMAIL_ALREADY_EXISTS: "Email đã được sử dụng",
      PHONE_ALREADY_EXISTS: "Số điện thoại đã được sử dụng",
    };

    const message = errors[error.message];

    return res.status(
      message ? 400 : 500
    ).json({
      success: false,
      message: message || "Không thể tạo tài khoản nhân viên",
    });
  }
}

export async function getAdminStaffRolesController(
  req: AdminRequest,
  res: Response
) {
  try {
    const data = await getAdminStaffRoles(req.admin!.roles);

    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("GET_ADMIN_STAFF_ROLES_ERROR:", error);

    return res.status(
      error.message === "SUPER_ADMIN_REQUIRED" ? 403 : 500
    ).json({
      success: false,
      message: error.message === "SUPER_ADMIN_REQUIRED"
        ? "Chỉ SUPER_ADMIN được xem vai trò quản trị"
        : "Không thể lấy danh sách vai trò",
    });
  }
}


export async function updateAdminStaffRoleController(
  req: AdminRequest,
  res: Response
) {
  try {
    const adminId = String(req.params.id || "");
    const { roleCode } = req.body;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId)) {
      return res.status(400).json({
        success: false,
        message: "ID nhân viên không hợp lệ",
      });
    }

    if (typeof roleCode !== "string" || !roleCode.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn vai trò",
      });
    }

    const data = await updateAdminStaffRole(
      adminId,
      roleCode,
      {
        adminId: req.admin!.id,
        roles: req.admin!.roles,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      }
    );

    return res.json({
      success: true,
      message: "Cập nhật vai trò thành công",
      data,
    });
    } catch (error: any) {
    console.error("UPDATE_ADMIN_STAFF_ROLE_ERROR:", error);

    const errors: Record<string, string> = {
      SUPER_ADMIN_REQUIRED: "Chỉ SUPER_ADMIN được phân quyền nhân viên",
      CANNOT_ASSIGN_SUPER_ADMIN: "Không thể gán vai trò SUPER_ADMIN",
      CANNOT_MODIFY_SUPER_ADMIN: "Không thể thay đổi vai trò SUPER_ADMIN",
      CANNOT_MODIFY_SELF: "Bạn không thể tự thay đổi vai trò của chính mình",
      STAFF_NOT_FOUND: "Không tìm thấy nhân viên",
      ROLE_NOT_FOUND: "Vai trò không tồn tại",
    };

    const message = errors[error.message];

    return res.status(
      message
        ? error.message === "STAFF_NOT_FOUND" ? 404 : 403
        : 500
    ).json({
      success: false,
      message: message || "Không thể cập nhật vai trò",
    });
  }
}

export async function updateAdminStaffStatusController(
  req: AdminRequest,
  res: Response
) {
  try {
    const adminId = String(req.params.id || "");
    const { status } = req.body;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId)
    ) {
      return res.status(400).json({
        success: false,
        message: "ID nhân viên không hợp lệ",
      });
    }

    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    const data = await updateAdminStaffStatus(
      adminId,
      status,
      {
        adminId: req.admin!.id,
        roles: req.admin!.roles,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      }
    );

    return res.json({
      success: true,
      message: status === "blocked"
        ? "Đã khóa tài khoản nhân viên"
        : "Đã mở khóa tài khoản nhân viên",
      data,
    });
  } catch (error: any) {
    console.error("UPDATE_ADMIN_STAFF_STATUS_ERROR:", error);

    const errors: Record<string, string> = {
      SUPER_ADMIN_REQUIRED: "Chỉ SUPER_ADMIN được quản lý nhân viên",
      CANNOT_MODIFY_SELF: "Bạn không thể tự khóa hoặc mở khóa tài khoản",
      CANNOT_MODIFY_SUPER_ADMIN: "Không thể khóa hoặc thay đổi SUPER_ADMIN",
      STAFF_NOT_FOUND: "Không tìm thấy nhân viên",
    };

    const message = errors[error.message];

    return res.status(
      message
        ? error.message === "STAFF_NOT_FOUND" ? 404 : 403
        : 500
    ).json({
      success: false,
      message: message || "Không thể cập nhật trạng thái nhân viên",
    });
  }
}


export async function getAdminStaffActivityLogsController(
  req: AdminRequest,
  res: Response
) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = String(req.query.search || "");
    const action = String(req.query.action || "");

    const data = await getAdminStaffActivityLogs(
      req.admin!.roles,
      page,
      limit,
      search,
      action
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("GET_ADMIN_STAFF_ACTIVITY_LOGS_ERROR:", error);

    return res.status(
      error.message === "SUPER_ADMIN_REQUIRED" ? 403 : 500
    ).json({
      success: false,
      message:
        error.message === "SUPER_ADMIN_REQUIRED"
          ? "Chỉ SUPER_ADMIN được xem lịch sử hoạt động nhân viên"
          : "Không thể lấy lịch sử hoạt động nhân viên",
    });
  }
}

