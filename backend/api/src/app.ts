import express, { Request, Response } from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import { testDatabaseConnection } from "./database/postgres";

import { requestId } from "./middleware/request-id";
import { notFound } from "./middleware/not-found";
import { errorHandler } from "./middleware/error-handler";
import authRoutes from "./modules/auth/auth.routes";
import { requestLogger } from "./middleware/request-logger";
import membersRoutes from "./modules/members/members.routes";
import menuRoutes from "./modules/menu/menu.routes";
import ordersRoutes from "./modules/orders/orders.routes";
import adminRoutes from "./modules/admin/admin.routes";
import inventoryRoutes from "./modules/inventory/inventory.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import deliveryRoutes from "./modules/delivery/delivery.routes";
import promotionRoutes from "./modules/promotion/promotion.routes";
import reviewRoutes from "./modules/review/review.routes";
dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);

// ============================================================
// Security middleware
// ============================================================

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    // Cho phép: các địa chỉ trong CORS_ORIGIN (cách nhau bởi dấu phẩy) và,
    // khi chạy thử (không phải production), mọi cổng của localhost / 127.0.0.1
    // (Flutter web mặc định chọn cổng ngẫu nhiên nên danh sách cố định sẽ bị chặn).
    origin: (origin, callback) => {
      const allowed = [
        "http://localhost:3001",
        "http://localhost:5173",
        ...(process.env.CORS_ORIGIN ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ];
      const isLocalDev =
        process.env.NODE_ENV !== "production" &&
        typeof origin === "string" &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

      if (!origin || allowed.includes(origin) || isLocalDev) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  })
);
// ============================================================
// Request ID
// ============================================================

app.use(requestId);

app.use(requestLogger);

// ============================================================
// Body parser
// ============================================================

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/members", membersRoutes);
app.use("/api/v1/menu", menuRoutes);
app.use("/api/v1/orders", ordersRoutes);
app.use("/api/v1/delivery", deliveryRoutes);
app.use("/api/v1/promotion", promotionRoutes);
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/admin/inventory", inventoryRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// ============================================================
// Health
// ============================================================

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await testDatabaseConnection();

    res.status(200).json({
      success: true,
      service: "tue-nguyen-api",
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId
    });
  } catch (error) {
    console.error("Health check failed:", error);

    res.status(503).json({
      success: false,
      service: "tue-nguyen-api",
      status: "unhealthy",
      database: "disconnected",
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId
    });
  }
});

// ============================================================
// Root
// ============================================================

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Tuệ Nguyên API",
    version: "1.0.0",
    status: "running",
    requestId: res.locals.requestId
  });
});

// ============================================================
// 404
// ============================================================

app.use(notFound);

// ============================================================
// Global error handler
// ============================================================

app.use(errorHandler);

// ============================================================
// Start server
// ============================================================

app.listen(PORT, () => {
  console.log(`Tuệ Nguyên API running at http://localhost:${PORT}`);
});
