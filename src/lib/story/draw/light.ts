import type { Rect } from "../formats";
import type { StoryPlan } from "../plan";
import { fillTexture, speckleTile, type Ctx } from "./util";

type Lighting = StoryPlan["lighting"];

/** Light pool on the wall around the artwork plus the beam falling from the ceiling. Drawn before the artwork. */
export function drawSpotlight(ctx: Ctx, lighting: Lighting, art: Rect) {
  if (!lighting.spotlight || lighting.cone <= 0) return;
  const cx = art.x + art.w / 2;
  const cy = art.y + art.h / 2;
  const tint = lighting.tint;

  // Beam from the top of the picture towards the wall.
  const beamTop = Math.max(0, art.y - art.h * 0.55);
  const beam = ctx.createLinearGradient(0, beamTop, 0, art.y + art.h * 0.9);
  beam.addColorStop(0, `rgba(${tint}, 0)`);
  beam.addColorStop(0.5, `rgba(${tint}, ${lighting.cone * 0.22})`);
  beam.addColorStop(1, `rgba(${tint}, ${lighting.cone * 0.1})`);
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx - art.w * 0.08, beamTop);
  ctx.lineTo(cx + art.w * 0.08, beamTop);
  ctx.lineTo(cx + art.w * 0.95, art.y + art.h * 0.9);
  ctx.lineTo(cx - art.w * 0.95, art.y + art.h * 0.9);
  ctx.closePath();
  ctx.fill();

  // Pool of light centred on the picture.
  ctx.save();
  ctx.translate(cx, cy);
  const rx = art.w * 0.95 + 120;
  const ry = art.h * 0.8 + 120;
  ctx.scale(1, ry / rx);
  const pool = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
  pool.addColorStop(0, `rgba(${tint}, ${lighting.cone * 0.6})`);
  pool.addColorStop(0.55, `rgba(${tint}, ${lighting.cone * 0.22})`);
  pool.addColorStop(1, `rgba(${tint}, 0)`);
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Room ambience over everything: color wash, edge vignette and film grain. */
export function drawAtmosphere(ctx: Ctx, lighting: Lighting, grain: boolean, w: number, h: number) {
  ctx.fillStyle = lighting.ambient;
  ctx.fillRect(0, 0, w, h);

  if (lighting.vignette > 0) {
    const r = Math.hypot(w, h) / 2;
    const v = ctx.createRadialGradient(w / 2, h * 0.46, r * 0.32, w / 2, h * 0.46, r * 1.02);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, lighting.vignette * 0.9)})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  if (grain) fillTexture(ctx, speckleTile(77, 0.06, "mono"), 0, 0, w, h);
}
