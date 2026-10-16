import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePassword } from "@/lib/super/password";
import { slugify, validateSlug } from "@/lib/validation/slug";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }).max(254, "Use at most 254 characters."));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`)
  .superRefine((value, ctx) => {
    const problem = validatePassword(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required.")
  .max(80, "Use at most 80 characters.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .nullish()
    .transform((value) => (value ? value : null));

export const createClientSchema = z
  .object({
    email: emailSchema,
    displayName: displayNameSchema,
    password: passwordSchema,
    museumTitle: optionalText(120),
    museumSlug: optionalText(40),
  })
  .superRefine((value, ctx) => {
    if (!value.museumTitle && value.museumSlug) {
      ctx.addIssue({ code: "custom", path: ["museumTitle"], message: "Add a title or clear the address." });
      return;
    }
    if (value.museumTitle) {
      const slug = value.museumSlug ?? slugify(value.museumTitle);
      const problem = validateSlug(slug);
      if (problem) ctx.addIssue({ code: "custom", path: ["museumSlug"], message: problem });
    }
  });

export type CreateClientInput = z.input<typeof createClientSchema>;
export type CreateClientParsed = z.output<typeof createClientSchema>;

/** Initial museum requested in the create form, or null when none was asked for. */
export function resolveInitialMuseum(input: Pick<CreateClientParsed, "museumTitle" | "museumSlug">) {
  if (!input.museumTitle) return null;
  return { title: input.museumTitle, slug: input.museumSlug ?? slugify(input.museumTitle) };
}

export const updateProfileSchema = z.object({ displayName: displayNameSchema });
export const changeEmailSchema = z.object({ email: emailSchema });
