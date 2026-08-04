const { defineConfig } = require('vite');
const fs = require('fs');
const path = require('path');

// Paso 1 de la modularización (Fase 2): probar que Vite puede procesar el
// sitio actual TAL CUAL, sin mover ni tocar ningún archivo fuente todavía.
//
// index.html carga vendor/*.js y logic.js con <script> planos (sin
// type="module"), a propósito: siguen siendo variables globales, no
// módulos ES — Vite por diseño no los "empaqueta" ni los copia solo. En
// vez de moverlos a public/ (rompería el import relativo '../logic.js'
// que ya usan los tests de Vitest, y el server estático directo que se
// usa para probar el sitio sin Vite), este plugin copia esos mismos
// archivos —tal cual están en el repo— al outDir en el mismo build.
function copiarAssetsPlanos() {
  const archivos = ['logic.js', 'vendor/jspdf.umd.min.js', 'vendor/qrcode.min.js', 'vendor/xlsx.core.min.js'];
  return {
    name: 'copiar-assets-planos',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      for (const rel of archivos) {
        const destino = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.copyFileSync(path.resolve(__dirname, rel), destino);
      }
    }
  };
}

module.exports = defineConfig({
  plugins: [copiarAssetsPlanos()],
  build: {
    outDir: 'dist'
  }
});
