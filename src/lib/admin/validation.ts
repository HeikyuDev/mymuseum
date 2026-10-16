import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePassword } from "@/lib/admin/password";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "val.email" }).max(254, "val.max:254"));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `val.passwordMin:${PASSWORD_MIN_LENGTH}`)
  .max(PASSWORD_MAX_LENGTH, `val.passwordMax:${PASSWORD_MAX_LENGTH}`)
  .superRefine((value, ctx) => {
    const problem = validatePassword(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "val.required")
  .max(80, "val.max:80");

export const createClientSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
});

export type CreateClientInput = z.input<typeof createClientSchema>;
export type CreateClientParsed = z.output<typeof createClientSchema>;

export const updateProfileSchema = z.object({ displayName: displayNameSchema });
export const changeEmailSchema = z.object({ email: emailSchema });
