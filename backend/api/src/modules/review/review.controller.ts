
import { Request, Response } from "express";
import * as reviewService from "./review.service";

export async function createFoodReview(
  req: Request,
  res: Response
) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập.",
      });
    }

    const {
      orderId,
      foodId,
      rating,
      title,
      content,
      imageUrls,
    } = req.body;

    if (
      typeof orderId !== "string" ||
      typeof foodId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Đơn hàng và món ăn không hợp lệ.",
      });
    }

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Số sao phải từ 1 đến 5.",
      });
    }

    if (
      title !== undefined &&
      (typeof title !== "string" || title.length > 255)
    ) {
      return res.status(400).json({
        success: false,
        message: "Tiêu đề không hợp lệ.",
      });
    }

    if (
      content !== undefined &&
      typeof content !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Nội dung đánh giá không hợp lệ.",
      });
    }

    if (
      imageUrls !== undefined &&
      (
        !Array.isArray(imageUrls) ||
        imageUrls.length > 5 ||
        !imageUrls.every(
          (url: unknown) =>
            typeof url === "string" &&
            url.trim().length > 0 &&
            url.length <= 2048
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Tối đa 5 hình ảnh hợp lệ.",
      });
    }

    const review = await reviewService.createFoodReview(
      userId,
      {
        orderId,
        foodId,
        rating,
        title,
        content,
        imageUrls,
      }
    );

    return res.status(201).json({
      success: true,
      message: "Gửi đánh giá thành công. Đánh giá đang chờ duyệt.",
      data: review,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    const errors: Record<string, string> = {
      ORDER_NOT_FOUND: "Không tìm thấy đơn hàng.",
      ORDER_NOT_COMPLETED: "Chỉ có thể đánh giá khi đơn hàng đã hoàn tất.",
      FOOD_NOT_IN_ORDER: "Món ăn không thuộc đơn hàng này.",
      REVIEW_ALREADY_EXISTS: "Bạn đã đánh giá món ăn này trong đơn hàng.",
    };

    if (errors[code]) {
      return res.status(400).json({
        success: false,
        message: errors[code],
      });
    }

    console.error("createFoodReview error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể gửi đánh giá.",
    });
  }
}


export async function getFoodReviews(
  req: Request,
  res: Response
) {
  try {
    const foodId = Array.isArray(req.params.foodId)
        ? req.params.foodId[0]
        : req.params.foodId;
        console.log("DEBUG getFoodReviews:", {
        params: req.params,
        foodId,
        length: foodId?.length,
      });

    if (!foodId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(foodId)) {
      return res.status(400).json({
        success: false,
        message: "Mã món ăn không hợp lệ.",
      });
    }

    const page = req.query.page === undefined
      ? 1
      : Number(req.query.page);

    const limit = req.query.limit === undefined
      ? 10
      : Number(req.query.limit);

    const ratingValue = req.query.rating === undefined
      ? undefined
      : Number(req.query.rating);

    const rating = ratingValue === undefined || ratingValue === 0
      ? undefined
      : ratingValue;

    const hasImagesValue = req.query.hasImages;

    const hasImages =
      hasImagesValue === "true" || hasImagesValue === "1";

    if (
      (rating !== undefined &&
        (!Number.isInteger(rating) || rating < 1 || rating > 5)) ||
      (hasImagesValue !== undefined &&
        !["true", "false", "1", "0"].includes(String(hasImagesValue)))
    ) {
      return res.status(400).json({
        success: false,
        message: "rating phải từ 1 đến 5; hasImages phải là true hoặc false.",
      });
    }

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "page phải >= 1; limit phải từ 1 đến 50.",
      });
    }

    const result = await reviewService.getFoodReviews(
      foodId,
      page,
      limit,
      rating,
      hasImages
    );

    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error) {
    console.error("getFoodReviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải đánh giá món ăn.",
    });
  }
}

export async function getFoodReviewStatus(
  req: Request,
  res: Response
) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập.",
      });
    }

    const orderId = Array.isArray(req.query.orderId)
      ? req.query.orderId[0]
      : req.query.orderId;

    const foodId = Array.isArray(req.query.foodId)
      ? req.query.foodId[0]
      : req.query.foodId;

    if (
      typeof orderId !== "string" ||
      typeof foodId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Đơn hàng và món ăn không hợp lệ.",
      });
    }

    const result = await reviewService.getFoodReviewStatus(
      userId,
      orderId,
      foodId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getFoodReviewStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể kiểm tra trạng thái đánh giá.",
    });
  }
}


export async function createOrderReview(
  req: Request,
  res: Response
) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập.",
      });
    }

    const { orderId, orderRating, serviceRating, deliveryRating,
      orderContent, serviceContent, deliveryContent } = req.body;

    if (
      typeof orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã đơn hàng không hợp lệ.",
      });
    }

    const ratings = [orderRating, serviceRating];

    if (deliveryRating !== undefined) {
      ratings.push(deliveryRating);
    }

    if (
      ratings.some(
        (rating) =>
          !Number.isInteger(rating) ||
          rating < 1 ||
          rating > 5
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Số sao phải từ 1 đến 5.",
      });
    }

    for (const content of [
      orderContent,
      serviceContent,
      deliveryContent,
    ]) {
      if (
        content !== undefined &&
        (typeof content !== "string" || content.length > 2000)
      ) {
        return res.status(400).json({
          success: false,
          message: "Nội dung đánh giá tối đa 2000 ký tự.",
        });
      }
    }

    const reviews = await reviewService.createOrderReview(
      userId,
      orderId,
      {
        orderRating,
        serviceRating,
        deliveryRating,
        orderContent,
        serviceContent,
        deliveryContent,
      }
    );

    return res.status(201).json({
      success: true,
      message: "Gửi đánh giá thành công.",
      data: reviews,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    const messages: Record<string, string> = {
      ORDER_NOT_FOUND: "Không tìm thấy đơn hàng.",
      ORDER_NOT_COMPLETED: "Đơn hàng chưa hoàn thành.",
      REVIEW_ALREADY_EXISTS: "Đơn hàng đã có đánh giá.",
      DELIVERY_RATING_REQUIRED: "Vui lòng đánh giá giao hàng.",
      DELIVERY_REVIEW_NOT_ALLOWED: "Đơn hàng này không có mục đánh giá giao hàng.",
      INVALID_RATING: "Số sao phải từ 1 đến 5.",
    };

    if (messages[code]) {
      return res.status(400).json({
        success: false,
        message: messages[code],
      });
    }

    console.error("createOrderReview error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể gửi đánh giá đơn hàng.",
    });
  }
}


export async function getOrderReviewStatus(
  req: Request,
  res: Response
) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập.",
      });
    }

    const orderId = req.query.orderId;

    if (
      typeof orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã đơn hàng không hợp lệ.",
      });
    }

    const result = await reviewService.getOrderReviewStatus(
      userId,
      orderId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getOrderReviewStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể kiểm tra trạng thái đánh giá.",
    });
  }
}


const REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "hidden",
  "deleted",
];

const REVIEW_TYPES = [
  "food",
  "order",
  "delivery",
  "reservation",
  "service",
];

export async function getAdminReviews(
  req: Request,
  res: Response
) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const status = req.query.status;
    const reviewType = req.query.reviewType;
    const rating = req.query.rating;
    const search = req.query.search;

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Tham số phân trang không hợp lệ.",
      });
    }

    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !REVIEW_STATUSES.includes(status))
    ) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái đánh giá không hợp lệ.",
      });
    }

    if (
      reviewType !== undefined &&
      (typeof reviewType !== "string" ||
        !REVIEW_TYPES.includes(reviewType))
    ) {
      return res.status(400).json({
        success: false,
        message: "Loại đánh giá không hợp lệ.",
      });
    }

    const parsedRating =
      rating === undefined ? undefined : Number(rating);

    if (
      parsedRating !== undefined &&
      (!Number.isInteger(parsedRating) ||
        parsedRating < 1 ||
        parsedRating > 5)
    ) {
      return res.status(400).json({
        success: false,
        message: "Số sao phải từ 1 đến 5.",
      });
    }

    if (
      search !== undefined &&
      (typeof search !== "string" || search.length > 200)
    ) {
      return res.status(400).json({
        success: false,
        message: "Từ khóa tìm kiếm không hợp lệ.",
      });
    }

    const result = await reviewService.getAdminReviews({
      page,
      limit,
      status: status as string | undefined,
      reviewType: reviewType as string | undefined,
      rating: parsedRating,
      search: search as string | undefined,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error) {
    console.error("getAdminReviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách đánh giá.",
    });
  }
}


import type { AdminRequest } from "../../middleware/admin.middleware";

export async function moderateReview(
  req: AdminRequest,
  res: Response
) {
  try {
    const adminId = req.admin?.id;
    const reviewId = req.params.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Không xác định được tài khoản quản trị.",
      });
    }

    if (
      typeof reviewId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reviewId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã đánh giá không hợp lệ.",
      });
    }

    const { status, adminNote } = req.body;

    if (!["approved", "rejected", "hidden"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái kiểm duyệt không hợp lệ.",
      });
    }

    if (
      adminNote !== undefined &&
      (typeof adminNote !== "string" || adminNote.length > 2000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Ghi chú tối đa 2000 ký tự.",
      });
    }

    const result = await reviewService.moderateReview(
      reviewId,
      adminId,
      status,
      adminNote
    );

    return res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái đánh giá thành công.",
      data: result,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "REVIEW_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá.",
      });
    }

    console.error("moderateReview error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể kiểm duyệt đánh giá.",
    });
  }
}


export async function replyToReviewController(
  req: AdminRequest,
  res: Response
) {
  try {
    const adminId = req.admin?.id;
    const reviewId = req.params.id;
    const { content } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Không xác định được tài khoản quản trị.",
      });
    }

    if (
      typeof reviewId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reviewId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã đánh giá không hợp lệ.",
      });
    }

    if (
      typeof content !== "string" ||
      !content.trim() ||
      content.trim().length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Nội dung phản hồi phải từ 1 đến 5000 ký tự.",
      });
    }

    const result = await reviewService.replyToReview(
      reviewId,
      adminId,
      content.trim()
    );

    return res.status(200).json({
      success: true,
      message: "Phản hồi đánh giá thành công.",
      data: result,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "REVIEW_NOT_FOUND_OR_NOT_APPROVED") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá hoặc đánh giá chưa được duyệt.",
      });
    }

    console.error("replyToReviewController error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể phản hồi đánh giá.",
    });
  }
}




