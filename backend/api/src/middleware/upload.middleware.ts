
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

// Railway: /app/uploads (Persistent Volume)
// Local: backend/api/uploads
const uploadRoot = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), "uploads");

const uploadDir = path.join(uploadRoot, "menu");

fs.mkdirSync(uploadDir, { recursive: true });

const bannerUploadDir = path.join(uploadRoot, "banners");

fs.mkdirSync(bannerUploadDir, { recursive: true });

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

function createStorage(destination: string) {
  return multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, destination);
    },
    filename: (_req, file, callback) => {
      callback(
        null,
        `${randomUUID()}${safeExtension(file.mimetype)}`
      );
    },
  });
}

export const uploadMenuImage = multer({
  storage: createStorage(uploadDir),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

export const uploadBannerImage = multer({
  storage: createStorage(bannerUploadDir),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});
