import { z } from "zod";

export const phoneSchema = z
  .string({ required_error: "Phone number is required" })
  .trim()
  .min(1, "Phone number cannot be empty")
  .transform((val) => val.replace(/[\s\-\(\)]/g, ""))
  .refine((val) => /^\d{10}$/.test(val), {
    message: "Phone number must be exactly 10 digits",
  })
  .refine((val) => !val.startsWith("0"), {
    message: "Phone number cannot start with 0",
  })
  .refine((val) => !/^(.)\1{9}$/.test(val), {
    message: "Phone number cannot have all same digits",
  })
  .refine((val) => /^[6-9]/.test(val), {
    message: "Indian mobile number must start with 6, 7, 8, or 9",
  })
  .refine((val) => !/^(.)\1{9}$/.test(val), {
    message: "Phone number cannot have all same digits",
  })
  .refine(
    (val) => {
      // Check for common invalid patterns
      const invalidPatterns = [
        "1234567890",
        "0000000000",
        "9999999999",
        "1111111111",
        "2222222222",
        "3333333333",
        "4444444444",
        "5555555555",
        "6666666666",
        "7777777777",
        "8888888888",
      ];
      return !invalidPatterns.includes(val);
    },
    {
      message: "Please enter a valid phone number",
    }
  );
