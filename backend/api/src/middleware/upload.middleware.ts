import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function safeExtension(mimetype: string): string {
  return IMAGE_EXTENSIONS[mimetype] ?? ".bin";
}

const uploadDir = path.resolve(process.cwd(), "uploads", "menu");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },
  filename: (_req, file, callback) => {
    // Đuôi file lấy theo loại ảnh đã kiểm tra, không tin tên file khách gửi lên
    callback(null, `${randomUUID()}${safeExtension(file.mimetype)}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  callback
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return callback(
      new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP")
    );
  }

  callback(null, true);
};

export const uploadMenuImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

const bannerUploadDir = path.resolve(
  process.cwd(),
  "uploads",
  "banners"
);

fs.mkdirSync(bannerUploadDir, { recursive: true });

const bannerStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, bannerUploadDir);
  },
  filename: (_req, file, callback) => {
    // Đuôi file lấy theo loại ảnh đã kiểm tra, không tin tên file khách gửi lên
    callback(null, `${randomUUID()}${safeExtension(file.mimetype)}`);
  },
});

export const uploadBannerImage = multer({
  storage: bannerStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});
