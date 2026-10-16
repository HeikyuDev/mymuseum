# 04 - Especificación de API, Server Actions y Panel de Administración

## 1. Visión General de la Capa de Aplicación y Administración
La administración de **Mi Museo** combina la potencia de **Next.js Server Actions** (con validación de tipos estricta mediante **Zod**) y componentes reactivos en el cliente para proporcionar:
1. Una gestión fluida de obras de arte (CRUD, subida de imágenes, detección de dimensiones y aspecto).
2. Personalización interactiva de la galería en tiempo real con un mini-visor 3D sincronizado (*Live 3D Preview*).
3. Aislamiento estricto de sesiones multi-inquilino (*tenant session validation*).

---

## 2. Definición de Server Actions y Endpoints de API

### 2.1. Gestión de Museos y Configuración (`/app/actions/museum.ts`)

#### `updateMuseumGeneral(data: UpdateMuseumInput)`
- **Propósito**: Modifica título, slug público y descripción del museo.
- **Validación**:
  - `title`: `z.string().min(3).max(150)`
  - `slug`: `z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(100)`
  - Verificación de unicidad de `slug` excluyendo el `museum_id` actual.
- **Autorización**: Requiere sesión activa del usuario dueño del `museum_id`.
- **Efecto Secundario**: Revalida tag de caché `revalidateTag('museum-[slug]')`.

#### `updateMuseumSettings(data: UpdateSettingsInput)`
- **Propósito**: Actualiza colores de pared, estilos de marcos por defecto, iluminación y texturas.
- **Esquema Zod**:
  ```typescript
  export const UpdateSettingsSchema = z.object({
    museumId: z.string().uuid(),
    wallColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
    wallTexture: z.enum(['plaster_smooth', 'concrete', 'brick']),
    floorTexture: z.enum(['wood_parquet', 'polished_marble', 'concrete']),
    ceilingColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
    defaultFrameStyle: z.enum(['MINIMALIST', 'WOOD', 'GOLD', 'METALLIC', 'CANVAS_WRAP']),
    defaultFrameColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
    lightingPreset: z.enum(['WARM_GALLERY', 'COLD_CONTEMPORARY', 'NEON_NOIR', 'DRAMATIC_SPOTLIGHT']),
    ambientIntensity: z.number().min(0.1).max(2.0),
    spotlightIntensity: z.number().min(0.0).max(3.0),
  });
  ```

---

### 2.2. Gestión de Obras de Arte (`/app/actions/artwork.ts`)

#### `createArtwork(data: CreateArtworkInput)`
- **Propósito**: Registra una nueva obra vinculada al museo del usuario autenticado.
- **Esquema Zod**:
  ```typescript
  export const CreateArtworkSchema = z.object({
    museumId: z.string().uuid(),
    title: z.string().min(1, "El título es obligatorio").max(200),
    artistName: z.string().max(150).default("Desconocido"),
    description: z.string().max(2000).optional(),
    year: z.number().int().min(0).max(new Date().getFullYear()).optional(),
    imageUrl: z.string().url("URL de imagen inválida"),
    thumbnailUrl: z.string().url().optional(),
    aspectRatio: z.number().positive(),
    widthMeters: z.number().min(0.3).max(6.0).default(1.5),
    heightMeters: z.number().min(0.3).max(6.0).default(1.5),
    wallIndex: z.number().int().min(0).max(7),
    positionX: z.number().default(0.0),
    positionY: z.number().default(1.6),
    positionZ: z.number().default(0.0),
    rotationY: z.number().default(0.0),
    frameStyle: z.enum(['MINIMALIST', 'WOOD', 'GOLD', 'METALLIC', 'CANVAS_WRAP']).optional(),
    frameColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    sortOrder: z.number().int().default(0),
  });
  ```

#### `updateArtwork(artworkId: string, data: UpdateArtworkInput)`
- **Propósito**: Modifica los metadatos o la posición 3D de una obra existente.
- **Validación de Seguridad**: Valida que la obra pertenezca al museo de propiedad del usuario autenticado.

#### `deleteArtwork(artworkId: string)`
- **Propósito**: Elimina la obra y desasigna el espacio en la pared.
- **Efecto Secundario**: Opcionalmente invoca la eliminación del archivo multimedia en el servicio de almacenamiento (Cloudinary / S3).

---

### 2.3. Endpoint de Subida de Archivos (`/api/upload`)
- **Método**: `POST` con `multipart/form-data`.
- **Flujo de Ejecución**:
  1. Verifica token de sesión.
  2. Valida tipo MIME (`image/jpeg`, `image/png`, `image/webp`).
  3. Procesa imagen mediante biblioteca `sharp` en el servidor:
     - Extrae dimensiones nativas (`width`, `height`) y calcula `aspectRatio`.
     - Normaliza imagen máxima a $2048 \times 2048$ en formato WebP con calidad 85%.
     - Genera miniatura optimizada de $400 \times 400$ píxeles.
  4. Sube los archivos procesados al almacenamiento (S3 o directorio local estático para desarrollo).
  5. Retorna `{ imageUrl, thumbnailUrl, aspectRatio, originalWidth, originalHeight }`.

---

## 3. Diseño de UI/UX del Panel de Administración (Dashboard)

### 3.1. Arquitectura de Pantallas
El panel se organiza en tres secciones principales:

```
[ Dashboard Layout ]
   ├── [ Navbar Superior: Nombre del Museo, Enlace Público (/m/[slug]), Estado de Publicación, Perfil ]
   ├── [ Pestañas de Navegación ]
   │      ├── 1. Obras de Arte (Artworks Gallery & Slot Allocator)
   │      ├── 2. Diseño de Galería & 3D Live Preview (Colors, Frames, Lights)
   │      └── 3. Configuración General (Slug, SEO, Título, Privacidad)
```

### 3.2. Módulo de Subida y Asignación de Obras
1. **Dropzone de Imágenes Interactivo**:
   - Arrastrar y soltar imagen con previsualización inmediata.
   - Cálculo automático en tiempo real de proporciones ($1:1$, $4:3$, $16:9$, etc.) y sugerencia de tamaño físico en metros ($1.2\text{m} \times 0.9\text{m}$).
2. **Formulario de Metadatos**:
   - Campos: Título, Artista, Año, Descripción / Ficha Curatorial.
   - Selector de marco: hereda el marco general del museo o permite personalización individual.
3. **Selector Visual de Pared (Wall Slot Picker)**:
   - Diagrama 2D simplificado tipo plano de arquitectura mostrando las paredes disponibles y los cuadros colgados.

### 3.3. Personalizador Estético con Live 3D Mini-Preview
Para evitar que el usuario deba guardar y recargar la página para ver los cambios:
- **División de Pantalla (Split Screen)**:
  - **Columna Izquierda**: Controles interactivos (Color Pickers con paletas recomendadas de museos, selectores de materiales de suelo, switches de presets de luz).
  - **Columna Derecha**: Visor 3D ligero embebido (Canvas R3F en tiempo real con OrbitControls restringidos) que reacciona instantáneamente al estado de los controles sin recargar la página.
- **Botón "Guardar Cambios" con retroalimentación visual**:
  - Indicador de estado "Guardado", "Guardando..." o "Cambios pendientes".
  - Notificación Toast accesible.
