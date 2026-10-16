"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getTenantContext } from "@/lib/auth";
import { z } from "zod";

// Esquema Zod para actualización de configuración estética
const UpdateSettingsSchema = z.object({
  wallColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal inválido"),
  ceilingColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal inválido"),
  defaultFrameStyle: z.enum([
    "MINIMALIST",
    "WOOD",
    "GOLD",
    "METALLIC",
    "CANVAS_WRAP",
  ]),
  defaultFrameColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal inválido"),
  lightingPreset: z.enum([
    "WARM_GALLERY",
    "COLD_CONTEMPORARY",
    "NEON_NOIR",
    "DRAMATIC_SPOTLIGHT",
  ]),
  ambientIntensity: z.number().min(0.1).max(2.0),
  spotlightIntensity: z.number().min(0.0).max(3.0),
});

export async function updateMuseumSettingsAction(formData: {
  wallColor: string;
  ceilingColor: string;
  defaultFrameStyle: string;
  defaultFrameColor: string;
  lightingPreset: string;
  ambientIntensity: number;
  spotlightIntensity: number;
}) {
  const { museum } = await getTenantContext();
  const validated = UpdateSettingsSchema.parse(formData);

  const updatedSettings = await prisma.museumSettings.upsert({
    where: { museumId: museum.id },
    create: {
      museumId: museum.id,
      ...validated,
    },
    update: validated,
  });

  revalidatePath(`/m/${museum.slug}`);
  revalidatePath("/admin");

  return { success: true, settings: updatedSettings };
}

// Esquema Zod para ajustes generales
const UpdateGeneralSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres").max(150),
  slug: z
    .string()
    .min(3, "El slug debe tener al menos 3 caracteres")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo puede contener letras minúsculas, números y guiones"),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().default(true),
});

export async function updateMuseumGeneralAction(formData: {
  title: string;
  slug: string;
  description?: string;
  isPublished: boolean;
}) {
  const { museum } = await getTenantContext();
  const validated = UpdateGeneralSchema.parse(formData);

  // Verificar si el slug ya está en uso por otro museo
  const existing = await prisma.museum.findFirst({
    where: {
      slug: validated.slug,
      NOT: { id: museum.id },
    },
  });

  if (existing) {
    return { success: false, error: "El slug ya se encuentra registrado por otro museo." };
  }

  const updatedMuseum = await prisma.museum.update({
    where: { id: museum.id },
    data: validated,
  });

  revalidatePath(`/m/${museum.slug}`);
  revalidatePath(`/m/${updatedMuseum.slug}`);
  revalidatePath("/admin");

  return { success: true, museum: updatedMuseum };
}

// Esquema Zod para creación de obra
const CreateArtworkSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(200),
  artistName: z.string().max(150).default("Desconocido"),
  description: z.string().max(2000).optional(),
  year: z.number().int().optional().nullable(),
  imageUrl: z.string().url("URL de imagen no válida"),
  aspectRatio: z.number().positive().default(1.0),
  widthMeters: z.number().min(0.4).max(6.0).default(1.8),
  heightMeters: z.number().min(0.4).max(6.0).default(1.5),
  wallIndex: z.number().int().min(0).max(3).default(0),
  positionX: z.number().default(0),
  positionY: z.number().default(1.7),
  positionZ: z.number().default(-7.94),
  rotationY: z.number().default(0),
  frameStyle: z
    .enum(["MINIMALIST", "WOOD", "GOLD", "METALLIC", "CANVAS_WRAP"])
    .optional()
    .nullable(),
  frameColor: z.string().optional().nullable(),
});

export async function createArtworkAction(data: {
  title: string;
  artistName?: string | null;
  description?: string | null;
  year?: number | null;
  imageUrl: string;
  aspectRatio?: number;
  widthMeters?: number;
  heightMeters?: number;
  wallIndex?: number;
  frameStyle?: string | null;
  frameColor?: string | null;
}) {
  const { museum } = await getTenantContext();

  const wallIndex = data.wallIndex ?? 0;
  const width = data.widthMeters ?? 1.8;
  const height = data.heightMeters ?? 1.5;

  // Cálculo automático de posición en pared según wallIndex
  let posX = 0;
  let posY = 1.7;
  let posZ = -7.94;
  let rotY = 0;

  // Contamos cuántas obras ya existen en esa pared para espaciarlas
  const countInWall = await prisma.artwork.count({
    where: { museumId: museum.id, wallIndex },
  });

  const offset = (countInWall % 3) * 5.0 - 5.0; // Desplazamiento -5, 0, +5

  if (wallIndex === 0) {
    // Pared Norte (Z = -7.94, mira a +Z)
    posX = offset;
    posZ = -7.94;
    rotY = 0;
  } else if (wallIndex === 1) {
    // Pared Este (X = 11.94, mira a -X)
    posX = 11.94;
    posZ = offset * 0.7;
    rotY = -Math.PI / 2;
  } else if (wallIndex === 2) {
    // Pared Sur (Z = 7.94, mira a -Z)
    posX = offset;
    posZ = 7.94;
    rotY = Math.PI;
  } else if (wallIndex === 3) {
    // Pared Oeste (X = -11.94, mira a +X)
    posX = -11.94;
    posZ = offset * 0.7;
    rotY = Math.PI / 2;
  }

  const validated = CreateArtworkSchema.parse({
    ...data,
    wallIndex,
    widthMeters: width,
    heightMeters: height,
    positionX: posX,
    positionY: posY,
    positionZ: posZ,
    rotationY: rotY,
    frameStyle: data.frameStyle || null,
    frameColor: data.frameColor || null,
  });

  const artwork = await prisma.artwork.create({
    data: {
      museumId: museum.id,
      ...validated,
    },
  });

  revalidatePath(`/m/${museum.slug}`);
  revalidatePath("/admin");

  return { success: true, artwork };
}

export async function deleteArtworkAction(artworkId: string) {
  const { museum } = await getTenantContext();

  await prisma.artwork.deleteMany({
    where: {
      id: artworkId,
      museumId: museum.id,
    },
  });

  revalidatePath(`/m/${museum.slug}`);
  revalidatePath("/admin");

  return { success: true };
}

export async function toggleArtworkActiveAction(artworkId: string, currentStatus: boolean) {
  const { museum } = await getTenantContext();

  const updated = await prisma.artwork.updateMany({
    where: {
      id: artworkId,
      museumId: museum.id,
    },
    data: {
      isActive: !currentStatus,
    },
  });

  revalidatePath(`/m/${museum.slug}`);
  revalidatePath("/admin");

  return { success: true, count: updated.count };
}
