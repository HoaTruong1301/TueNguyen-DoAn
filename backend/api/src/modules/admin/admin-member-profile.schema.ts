
import { z } from "zod";

export const updateAdminMemberProfileSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(1, "Họ tên không được để trống")
      .max(150, "Họ tên tối đa 150 ký tự")
      .optional(),

    phone_number: z
      .string()
      .trim()
      .max(20, "Số điện thoại tối đa 20 ký tự")
      .nullable()
      .optional(),

    date_of_birth: z
      .string()
      .date("Ngày sinh không hợp lệ")
      .nullable()
      .optional(),

    gender: z
      .enum(["male", "female", "other"])
      .nullable()
      .optional(),

    avatar_url: z
      .string()
      .trim()
      .max(2000, "Đường dẫn ảnh quá dài")
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "Vui lòng cung cấp ít nhất một trường cần cập nhật",
    }
  );

export type UpdateAdminMemberProfileInput = z.infer<
  typeof updateAdminMemberProfileSchema
>;
