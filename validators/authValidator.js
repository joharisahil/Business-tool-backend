import { z } from "zod";

const gstRegex =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),

  email: z.string().email("Invalid email format"),

  password: z.string().min(6, "Password must be at least 6 characters"),

  role: z.enum(["admin", "manager", "staff"]),

  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Invalid Indian phone number")
    .optional()
    .or(z.literal("")),

  gstNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || gstRegex.test(val),
      "Invalid GST number format"
    ),
});
  export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });