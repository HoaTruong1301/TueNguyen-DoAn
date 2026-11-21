
import { Request, Response } from "express";
import * as menuService from "./menu.service";

export async function getCategories(
  _req: Request,
  res: Response
) {
  try {
    const categories = await menuService.getCategories();

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh mục món ăn",
    });
  }
}

export async function getFoods(
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

    const categoryRaw = req.query.categoryId;
    const searchRaw = req.query.search;

    if (
      categoryRaw !== undefined &&
      typeof categoryRaw !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "categoryId không hợp lệ",
      });
    }

    if (
      searchRaw !== undefined &&
      typeof searchRaw !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "search không hợp lệ",
      });
    }

    const result = await menuService.getFoods(
      page,
      limit,
      categoryRaw as string | undefined,
      searchRaw as string | undefined
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
      message: "Không thể lấy danh sách món ăn",
    });
  }
}

export async function getFoodById(
  req: Request,
  res: Response
) {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: "ID món ăn không hợp lệ",
      });
    }

    const food = await menuService.getFoodById(id);

    return res.status(200).json({
      success: true,
      data: food,
    });
  } catch (error: any) {
    if (error.message === "FOOD_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy món ăn",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy chi tiết món ăn",
    });
  }
}

export async function getFeaturedFoods(
  req: Request,
  res: Response
) {
  try {
    const limitRaw = req.query.limit;
    const limit = limitRaw === undefined ? 10 : Number(limitRaw);

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "limit phải từ 1 đến 50",
      });
    }

    const foods = await menuService.getFeaturedFoods(limit);

    return res.status(200).json({
      success: true,
      data: foods,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy món nổi bật",
    });
  }
}

export async function getBanners(
  _req: Request,
  res: Response
) {
  try {
    const banners = await menuService.getBanners();

    return res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách banner",
    });
  }
}
