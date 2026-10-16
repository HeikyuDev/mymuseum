"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { z } from "zod";

const CreateAdminSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  museumTitle: z.string().min(3, "El título del museo debe tener al menos 3 caracteres"),
  slug: z
    .string()
    .min(3, "El slug debe tener al menos 3 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo puede contener letras minúsculas y guiones"),
});

export async function createMuseumAdminAction(data: {
  name: string;
  email: string;
  museumTitle: string;
  slug: string;
}) {
  const validated = CreateAdminSchema.parse(data);

  // Verificar si el email o slug ya existen
  const existingEmail = await prisma.user.findUnique({
    where: { email: validated.email },
  });

  if (existingEmail) {
    return { success: false, error: "Ya existe un usuario con este correo electrónico." };
  }

  const existingSlug = await prisma.museum.findUnique({
    where: { slug: validated.slug },
  });

  if (existingSlug) {
    return { success: false, error: "El slug ya está en uso por otro museo." };
  }

  // Crear usuario admin y su museo con configuración por defecto
  const user = await prisma.user.create({
    data: {
      name: validated.name,
      email: validated.email,
      passwordHash: "$2b$10$ep5uU5qN/qM9p3N9xO8EWeuN2oQhW6o7w.cO8lZ9j9jK9qK9qK9qK", // Hash predeterminado
      role: "ADMIN",
      museums: {
        create: {
          title: validated.museumTitle,
          slug: validated.slug,
          description: `Museo virtual curado por ${validated.name}.`,
          isPublished: true,
          settings: {
            create: {
              wallColor: "#ECE8E1",
              ceilingColor: "#F9F8F5",
              defaultFrameStyle: "GOLD",
              defaultFrameColor: "#C5A059",
              lightingPreset: "WARM_GALLERY",
              ambientIntensity: 0.55,
              spotlightIntensity: 1.3,
            },
          },
        },
      },
    },
    include: {
      museums: true,
    },
  });

  revalidatePath("/");
  revalidatePath(`/m/${validated.slug}`);

  return { success: true, user, museum: user.museums[0] };
}

export async function deleteMuseumAction(museumId: string) {
  await prisma.museum.delete({
    where: { id: museumId },
  });

  revalidatePath("/");
  return { success: true };
}
