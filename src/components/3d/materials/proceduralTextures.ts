import * as THREE from "three";

/**
 * Genera una textura procedimental de parquet de madera clara de alta calidad
 */
export function createParquetTexture(): THREE.CanvasTexture {
  if (typeof document === "undefined") {
    return new THREE.CanvasTexture({} as HTMLCanvasElement);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Fondo base madera
    ctx.fillStyle = "#A88358";
    ctx.fillRect(0, 0, 512, 512);

    const plankWidth = 64;
    const plankLength = 256;

    // Patrón de tablones entrelazados
    for (let y = 0; y < 512; y += plankWidth) {
      for (let x = 0; x < 512; x += plankLength) {
        const offset = (y / plankWidth) % 2 === 0 ? 0 : plankLength / 2;
        const actualX = (x + offset) % 512;

        // Tonalidad sutil de cada listón
        const toneVar = Math.sin(actualX * 0.1 + y * 0.2) * 12;
        ctx.fillStyle = `rgb(${165 + toneVar}, ${128 + toneVar * 0.8}, ${85 + toneVar * 0.5})`;
        ctx.fillRect(actualX, y, plankLength - 2, plankWidth - 2);

        // Veta de madera
        ctx.strokeStyle = "rgba(100, 70, 40, 0.15)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(actualX, y + i * 14 + Math.random() * 4);
          ctx.lineTo(actualX + plankLength, y + i * 14 + Math.random() * 4);
          ctx.stroke();
        }

        // Biselado del borde del listón
        ctx.strokeStyle = "rgba(45, 30, 15, 0.4)";
        ctx.strokeRect(actualX, y, plankLength - 2, plankWidth - 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 6);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/**
 * Genera un bump/normal map sutil para acabado de estuco o yeso en paredes
 */
export function createPlasterBumpMap(): THREE.CanvasTexture {
  if (typeof document === "undefined") {
    return new THREE.CanvasTexture({} as HTMLCanvasElement);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const imgData = ctx.createImageData(256, 256);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const noise = 128 + (Math.random() - 0.5) * 35;
      imgData.data[i] = noise;
      imgData.data[i + 1] = noise;
      imgData.data[i + 2] = noise;
      imgData.data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 6);
  return texture;
}
