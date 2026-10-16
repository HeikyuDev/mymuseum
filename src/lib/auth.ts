import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const DEMO_USER_EMAIL = "curador@mimuseo.com";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface TenantContext {
  user: SessionUser;
  museum: {
    id: string;
    title: string;
    slug: string;
  };
}

/**
 * Obtiene el usuario autenticado actual o el usuario demo predeterminado
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("mimuseo_session")?.value;

  // Si existe cookie con email o sesión activa, buscamos el usuario
  const emailToLookup = sessionToken || DEMO_USER_EMAIL;

  const user = await prisma.user.findUnique({
    where: { email: emailToLookup },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  return user;
}

/**
 * Resuelve el contexto de Tenant seguro para el usuario autenticado.
 * Garantiza que las mutaciones administrativas pertenezcan al museo del usuario.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No autenticado: Se requiere inicio de sesión.");
  }

  // Obtenemos el museo principal asociado al usuario
  let museum = await prisma.museum.findFirst({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      slug: true,
    },
  });

  // Si el usuario no tiene museo aún, creamos su galería inicial
  if (!museum) {
    museum = await prisma.museum.create({
      data: {
        userId: user.id,
        title: `Galería de ${user.name}`,
        slug: `galeria-${user.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        settings: {
          create: {},
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
      },
    });
  }

  return { user, museum };
}
