
import { Request, Response } from "express";
import {
  getAdminMembers,
  AdminMemberFilters,
} from "./admin-members.service";

/**
 * GET /api/v1/admin/members
 * Lấy danh sách khách hàng dành cho Admin.
 */
export async function getAdminMembersController(
  req: Request,
  res: Response
) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    const search =
      typeof req.query.search === "string"
        ? req.query.search
        : undefined;

    const sortBy =
      typeof req.query.sortBy === "string"
        ? req.query.sortBy
        : "newest";

    const filters: AdminMemberFilters = {
      page,
      limit,
      status,
      search,
      sortBy: sortBy as AdminMemberFilters["sortBy"],
    };

    const result = await getAdminMembers(filters);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách khách hàng thành công",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error(
      "Get admin members error:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "INVALID_MEMBER_SORT"
    ) {
      return res.status(400).json({
        success: false,
        message: "Kiểu sắp xếp khách hàng không hợp lệ",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách khách hàng",
    });
  }
}
