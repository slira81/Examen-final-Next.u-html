/* Ajustes gráficos del render 3D (compartidos por motor, entidades y partículas). */
const PRESETS = {
  low: { shadows: false, shadowSize: 1024, dprCap: 1, scale: 0.8, particles: 0.35, decor: false },
  medium: { shadows: true, shadowSize: 1024, dprCap: 1.5, scale: 1, particles: 0.7, decor: true },
  high: { shadows: true, shadowSize: 2048, dprCap: 2, scale: 1, particles: 1, decor: true },
};
const Q = Object.assign({ preset: 'high' }, PRESETS.high);
export { Q, PRESETS };
