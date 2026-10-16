# 03 - Especificación del Motor 3D (Three.js & React Three Fiber)

## 1. Visión General del Motor 3D
El motor gráfico de **Mi Museo** está construido sobre **React Three Fiber (R3F)** y **Three.js**, diseñado para garantizar una experiencia interactiva en primera persona a 60 FPS tanto en navegadores de escritorio de alta gama como en dispositivos móviles de gama media/baja.

El sistema se basa en una arquitectura modular compuesta por:
1. **Scene Layout Manager**: Estructura física de la galería (suelos, paredes, techo, zócalos y zonas de circulación).
2. **Lighting & Shadow Engine**: Módulo de iluminación dinámica adaptable a preajustes (Cálido, Frío, Neón, Foco Teatral).
3. **Artwork Frame & Canvas Mesh**: Generación procedural y reutilizable de marcos y lienzos con relaciones de aspecto dinámicas.
4. **Camera & Input Controller**: Doble sistema de control (WASD + PointerLock para Desktop; Virtual Joystick + Touch drag para Mobile).
5. **Raycasting & Interaction Pipeline**: Detección de colisiones visuales, hover interactivo, enfoque cinemático de cámara e invocación de ficha técnica.
6. **Performance & Memory Optimizer**: Recolección de basura (*dispose*), frustum culling y mipmapping controlado.

---

## 2. Estructura de la Galería 3D (Scene Layout)

### 2.1. Dimensiones y Geometría del Recinto
La galería estándar utiliza un sistema de coordenadas en metros ($1.0 \text{ unit} = 1.0 \text{ metro}$):
- **Área Principal**: Galería rectangular de $24\text{m (ancho)} \times 16\text{m (profundidad)} \times 4.2\text{m (altura)}$.
- **Paredes Perimetrales**: 4 paredes principales con divisiones internas modulares (paredes divisorias o tabiques exentos de $6\text{m} \times 3.8\text{m}$).
- **Espacios para Cuadros (Wall Slots)**: Cada pared dispone de ranuras precalculadas con coordenadas $(x, y, z)$ y rotación en $Y$ ($\text{rotY}$) normalizadas hacia el centro de la sala.

```
       [ Pared Norte (Wall 0) - 24m ]
   +-------------------------------------+
   |      [W0-S1]    [W0-S2]    [W0-S3]  |
   |                                     |
 P | [W3-S1]                     [W1-S1] | P
 a |                                     | a
 r |            [ Tabique ]              | r
 e |          [W4-S1] [W4-S2]            | e
 d |                                     | d
   | [W3-S2]                     [W1-S2] |
 O |                                     | E
 e |                                     | s
 s |      [W2-S1]    [W2-S2]    [W2-S3]  | t
 t |                                     | e
 e +------------------[Puerta]-----------+
       [ Pared Sur (Wall 2) - 24m ]
```

### 2.2. Sistema de Coordenadas de Obra
Cada cuadro se posiciona automáticamente asegurando:
- **Altura del Centro Focal ($Y$)**: $1.60\text{m}$ sobre el suelo (altura estándar de montaje museográfico a nivel de ojos).
- **Offset de Pared ($Z$ local)**: Separación de $+0.04\text{m}$ respecto a la superficie de la pared para evitar artefactos de *Z-fighting*.
- **Rotación ($Y$)**: Tangente al plano de la pared apuntando hacia el interior de la sala.

---

## 3. Sistema de Iluminación y Sombras

### 3.1. Presets de Iluminación
El administrador puede seleccionar entre 4 perfiles lumínicos:

| Preset | Luz Ambiental (Color / Int.) | Luz Hemisférica (Sky / Ground) | Luces Puntuales / Spotlights | Sensación Visual |
| :--- | :--- | :--- | :--- | :--- |
| **`warm_gallery`** | `#FFF5E6`, `0.45` | `#FFEEDB` / `#8B7355`, `0.3` | `#FFF0D4`, `1.2`, Spotlights dirigidos a cuadros con `angle: 0.45rad`, `penumbra: 0.6` | Clásica, acogedora, elegante |
| **`cold_contemporary`**| `#F0F4F8`, `0.40` | `#E0E8F0` / `#4A5568`, `0.3` | `#FFFFFF`, `1.1`, luces direccionales limpias con `penumbra: 0.4` | Moderna, minimalista, museo MoMA |
| **`neon_noir`** | `#1A0B2E`, `0.20` | `#3B1C5A` / `#0D0614`, `0.1` | Acentos en Cyan `#00F0FF` y Magenta `#FF007F` dirigidos | Vanguardista, ciberarte, nocturna |
| **`dramatic_spotlight`**| `#0A0A0A`, `0.15` | `#1A1A1A` / `#000000`, `0.1` | Spotlights focalizados `#FFE8C2`, `2.0`, haz estrecho `angle: 0.3rad` | Alto contraste, foco teatral en la obra |

### 3.2. Configuración de Sombras y Rendimiento
- **Renderizador**: `WebGLRenderer` con `toneMapping = THREE.ACESFilmicToneMapping` y `toneMappingExposure = 1.0`.
- **Shadow Map**: `THREE.PCFSoftShadowMap`.
- **Optimización**: Solo los focos de obras seleccionadas proyectan sombras (`castShadow = true`). La luz ambiental y las paredes traseras reciben sombras precalculadas o simplificadas (`receiveShadow = true`). Resolución máxima de sombra: $1024 \times 1024$ en desktop, $512 \times 512$ en mobile.

---

## 4. Configuración de Materiales, Paredes y Marcos 3D

### 4.1. Texturas de Pared y Piso
- **Material de Pared**: `MeshStandardMaterial` con rugosidad alta (`roughness: 0.85`), `metalness: 0.05` y mapa normal sutil para emular yeso o estuco fino.
- **Piso**: Material estándar con mapa de rugosidad (`roughness: 0.25` para parquet pulido o mármol reflectante ligero).

### 4.2. Generador de Marcos 3D (3D Frame Meshes)
Cada obra se ensambla mediante una jerarquía de geometrías reutilizables:

```
[ ArtworkGroup ]
   ├── [ CanvasMesh (Plano con imagen de la obra) ]
   ├── [ FrameMesh (Extrusión 3D o 4 barras perimetrales) ]
   └── [ GlassMesh (Plano frontal transparente opcional) ]
```

#### Estilos de Marco Disponibles:
1. **`MINIMALIST`**: Perfil de aluminio ultra delgado ($0.02\text{m}$ de grosor, $0.03\text{m}$ de profundidad), color negro mate o blanco.
2. **`WOOD`**: Moldura de madera cálida biselada ($0.07\text{m}$ ancho, $0.05\text{m}$ profundidad), textura de veta de roble/nogal.
3. **`GOLD`**: Marco clásico ornamental con acabado dorado satinado (`roughness: 0.3`, `metalness: 0.85`, color `#D4AF37`).
4. **`METALLIC`**: Acabado cromo o titanio cepillado (`roughness: 0.2`, `metalness: 0.95`).
5. **`CANVAS_WRAP`**: Lienzo continuo sin marco exterior. La imagen se extiende o dobla sobre los bordes laterales ($0.04\text{m}$ de grosor).

---

## 5. Controles de Movimiento e Inmersión

### 5.1. Dispositivos de Escritorio (Desktop)
- **Modo**: Primera persona (*First-Person Camera*).
- **Rotación de Cámara**: `PointerLockControls` de Three.js (bloqueo del cursor del mouse al hacer clic en el canvas).
- **Desplazamiento**: Teclas `W`, `A`, `S`, `D` o flechas de dirección.
  - Velocidad de caminata: $3.5\text{ m/s}$.
  - Fricción/Inercia: Amortiguación vectorial (*damping*) para movimientos fluidos sin tirones.
  - Tecla `Shift`: Aumento de velocidad a $5.0\text{ m/s}$.
  - Tecla `Espacio` o `Escape`: Liberar puntero de mouse.

### 5.2. Dispositivos Móviles y Tablets (Touch & Joypad)
- **Pantalla Dividida**:
  - **Mitad Izquierda de Pantalla**: Virtual Joystick flotante dinámico (desplaza al visitante hacia adelante, atrás, izquierda y derecha).
  - **Mitad Derecha de Pantalla**: Detección de arrastre táctil (*touch drag*) para orientar la vista (Pitch / Yaw).
- **Doble Toque (Double Tap)**: Teletransporte automático a la posición frente a una obra tocada.

---

## 6. Sistema de Raycasting e Interacción con Obras

### 6.1. Detección por Raycasting
Un `THREE.Raycaster` rastrea continuamente el puntero en desktop (o el centro de la pantalla en modo PointerLock).
- **Objetos Objetivo**: Solo los *meshes* de las obras (`layer: 1` o etiqueta `isArtwork = true`).
- **Estado Hover**:
  - Al posarse sobre una obra: Retícula (*crosshair*) se expande suavemente, borde sutil del marco adquiere un resplandor emisivo (`emissive: #FFFFFF`, `emissiveIntensity: 0.25`).
  - Cursor cambia a estilo `pointer`.

### 6.2. Enfoque Cinemático y Transición Suave (Camera Tween)
Al hacer clic en una obra:
1. Se desactiva temporalmente el control de caminata libre.
2. Se calcula la posición ideal de visualización:
   $$\vec{P}_{\text{target}} = \vec{P}_{\text{artwork}} + \vec{N}_{\text{artwork}} \times d_{\text{focus}}$$
   *(donde $\vec{N}$ es la normal de la pared y $d_{\text{focus}}$ es la distancia óptima calculada en función de las dimensiones de la obra).*
3. **Interpolación Suave (Camera Slerp/GSAP)**:
   - Duración: $1.2\text{ segundos}$ con curva de aceleración `easeInOutCubic`.
   - La cámara se traslada a $\vec{P}_{\text{target}}$ y se orienta perpendicularmente al lienzo.
4. **Despliegue de Ficha Técnica**:
   - Se abre un panel modal no intrusivo en el DOM con: Título, Artista, Año, Técnica/Descripción y botón de zoom en alta definición.
5. **Retorno**: Al cerrar el modal o pulsar tecla `Escape`, la cámara regresa suavemente a la posición anterior y reactiva los controles.

---

## 7. Optimización de FPS y Consumo de Recursos

1. **Gestión de Texturas y Mipmapping**:
   - Generación automática de niveles de mipmap (`texture.generateMipmaps = true`, `texture.minFilter = THREE.LinearMipmapLinearFilter`).
   - Carga diferida progresiva: Inicialmente se renderiza un *placeholder* borroso o miniatura ligera; la textura completa en alta resolución se carga asíncronamente cuando el usuario entra en el campo de visión.
2. **Frustum Culling**:
   - Activado en todas las mallas. Obras situadas en paredes a espaldas de la cámara no consumen ciclos de cálculo de shader de fragmentos.
3. **Reutilización de Geometrías y Materiales**:
   - Las geometrías de las paredes, zócalos, focos y marcos comparten instancias idénticas (`BoxGeometry`, `CylinderGeometry`) variando únicamente matrices de transformación.
4. **Liberación de Memoria (Disposal Lifecycle)**:
   - Limpieza rigurosa de texturas WebGL y geometrías en el evento `componentWillUnmount` de React para prevenir fugas de memoria en cambios de ruta.
