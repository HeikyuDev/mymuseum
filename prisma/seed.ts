import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Sincronizando datos con arquitectura de Galería Lineal Infinita...");

  // Limpiar registros previos
  await prisma.artwork.deleteMany();
  await prisma.museumSettings.deleteMany();
  await prisma.museum.deleteMany();
  await prisma.user.deleteMany();

  // 1. Crear usuario administrador
  const user = await prisma.user.create({
    data: {
      email: "curador@mimuseo.com",
      passwordHash: "$2b$10$ep5uU5qN/qM9p3N9xO8EWeuN2oQhW6o7w.cO8lZ9j9jK9qK9qK9qK",
      name: "Augusto Pedernera",
      role: "ADMIN",
    },
  });

  // 2. Crear Museo principal
  const museum = await prisma.museum.create({
    data: {
      userId: user.id,
      title: "Galería de Grandes Maestros",
      slug: "galeria-maestros",
      description:
        "Exposición lineal continua en espacio arquitectónico minimalista infinito.",
      isPublished: true,
      settings: {
        create: {
          wallColor: "#ECE8E1",
          wallTexture: "plaster_smooth",
          floorTexture: "wood_parquet",
          ceilingColor: "#F9F8F5",
          defaultFrameStyle: "GOLD",
          defaultFrameColor: "#C5A059",
          lightingPreset: "WARM_GALLERY",
          ambientIntensity: 0.55,
          spotlightIntensity: 1.3,
        },
      },
    },
  });

  // 3. Obras secuenciales a lo largo del eje X (cada 8 metros en la pared Norte Z = -4.96)
  const masterpieces = [
    {
      title: "La Noche Estrellada",
      artistName: "Vincent van Gogh",
      year: 1889,
      description:
        "Óleo sobre lienzo pintado en junio de 1889 en Saint-Rémy-de-Provence. Expresión sublime de remolinos celestes y vibración emocional.",
      imageUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=1200&auto=format&fit=crop",
      aspectRatio: 1.25,
      widthMeters: 2.3,
      heightMeters: 1.84,
      frameStyle: "GOLD",
      frameColor: "#D4AF37",
    },
    {
      title: "La Joven de la Perla",
      artistName: "Johannes Vermeer",
      year: 1665,
      description:
        "Conocida como 'La Mona Lisa del Norte'. Destaca el uso magistral de la luz sobre el pendiente de perla y la mirada directa.",
      imageUrl: "https://images.unsplash.com/photo-1582561424760-0321d75e81fa?q=80&w=1200&auto=format&fit=crop",
      aspectRatio: 0.85,
      widthMeters: 1.6,
      heightMeters: 1.88,
      frameStyle: "WOOD",
      frameColor: "#3B2219",
    },
    {
      title: "El Nacimiento de Venus",
      artistName: "Sandro Botticelli",
      year: 1485,
      description:
        "Témpera monumental conservada en la Galería Uffizi en Florencia. Mito de la diosa del amor emergiendo del mar.",
      imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1200&auto=format&fit=crop",
      aspectRatio: 1.5,
      widthMeters: 2.8,
      heightMeters: 1.86,
      frameStyle: "GOLD",
      frameColor: "#C5A059",
    },
    {
      title: "El Gran Canal de Venecia",
      artistName: "Claude Monet",
      year: 1908,
      description:
        "Estudio impresionista de reflejos y bruma sobre las aguas venecianas frente a Santa Maria della Salute.",
      imageUrl: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?q=80&w=1200&auto=format&fit=crop",
      aspectRatio: 1.25,
      widthMeters: 2.3,
      heightMeters: 1.84,
      frameStyle: "MINIMALIST",
      frameColor: "#1A1A1A",
    },
    {
      title: "Nenúfares en Armonía",
      artistName: "Claude Monet",
      year: 1916,
      description:
        "Monumento al lirismo del agua, la vegetación y la luz cambiante en el estanque de Giverny.",
      imageUrl: "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?q=80&w=1200&auto=format&fit=crop",
      aspectRatio: 1.4,
      widthMeters: 2.6,
      heightMeters: 1.85,
      frameStyle: "WOOD",
      frameColor: "#4A3525",
    },
    {
      title: "Composición en Rojo y Azul",
      artistName: "Piet Mondrian",
      year: 1930,
      description:
        "Cúspide del Neoplasticismo y abstracción geométrica: ritmo visual mediante líneas ortogonales y colores primarios puros.",
      imageUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1200&auto=format&fit=crop",
      aspectRatio: 1.0,
      widthMeters: 1.9,
      heightMeters: 1.9,
      frameStyle: "MINIMALIST",
      frameColor: "#0F0F0F",
    },
  ];

  // Distribuir secuencialmente a lo largo de una única gran pared (eje X, Z = -4.96)
  const spacingMeters = 8.0;

  for (let i = 0; i < masterpieces.length; i++) {
    const art = masterpieces[i];
    const posX = i * spacingMeters;

    await prisma.artwork.create({
      data: {
        museumId: museum.id,
        title: art.title,
        artistName: art.artistName,
        year: art.year,
        description: art.description,
        imageUrl: art.imageUrl,
        aspectRatio: art.aspectRatio,
        widthMeters: art.widthMeters,
        heightMeters: art.heightMeters,
        wallIndex: 0,
        positionX: posX,
        positionY: 1.7,
        positionZ: -4.82, // Frente de la pared continua
        rotationY: 0.0,
        frameStyle: art.frameStyle,
        frameColor: art.frameColor,
        sortOrder: i + 1,
        isActive: true,
      },
    });
  }

  console.log(`✅ ${masterpieces.length} obras sembradas en secuencia lineal infinita.`);
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
