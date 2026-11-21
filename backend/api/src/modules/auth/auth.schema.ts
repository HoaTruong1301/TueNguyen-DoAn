import { z } from "zod";

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Email không hợp lệ.")
      .toLowerCase()
      .optional(),

    phone: z
      .string()
      .trim()
      .min(9, "Số điện thoại không hợp lệ.")
      .max(20, "Số điện thoại không hợp lệ.")
      .optional(),

    password: z
      .string()
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
      .max(72, "Mật khẩu không được quá 72 ký tự."),

    confirmPassword: z
      .string()
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Mật khẩu xác nhận không khớp.",
      path: ["confirmPassword"]
    }
  )
  .refine(
    (data) => Boolean(data.email || data.phone),
    {
      message: "Phải cung cấp email hoặc số điện thoại.",
      path: ["email"]
    }
  );

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Email hoặc số điện thoại không hợp lệ."),

  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu.")
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;