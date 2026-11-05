import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Módulos VBA del Excel conectado (excel/vba): el Editor de VBA los lee en Windows-1252 y no tolera
// una comilla sin duplicar dentro de un texto (pasó el 2026-11-05: «Presiona "Conectar".» no compilaba).
const dir = path.join(__dirname, '..', 'excel', 'vba');
const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.bas'));

function sinComentario(linea) {
  // corta en el primer apóstrofo que esté fuera de un texto entre comillas
  let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') dentro = !dentro;
    else if (c === "'" && !dentro) return linea.slice(0, i);
  }
  return linea;
}

describe('módulos VBA de excel/vba', () => {
  it('hay al menos un módulo', () => expect(archivos.length).toBeGreaterThan(0));
  for (const f of archivos) {
    const bytes = fs.readFileSync(path.join(dir, f));
    it(`${f}: está en Windows-1252 (no UTF-8) y con saltos CRLF`, () => {
      expect(bytes.includes(Buffer.from([0xc3]))).toBe(false); // «ó» en UTF-8 empieza con C3
      expect(bytes.toString('latin1')).toMatch(/\r\n/);
    });
    it(`${f}: los textos entre comillas están bien cerrados`, () => {
      // Recorre cada texto "…" (con "" como comilla escapada). Error si una línea queda con un texto abierto
      // o si justo después de cerrar un texto viene una letra (señal de una comilla sin duplicar: "Presiona "Conectar").
      const lineas = bytes.toString('latin1').split(/\r?\n/);
      const malas = [];
      lineas.forEach((l, idx) => {
        const code = sinComentario(l);
        let i = 0, abierto = false;
        while (i < code.length) {
          if (code[i] !== '"') { i++; continue; }
          i++; abierto = true;
          while (i < code.length) {
            if (code[i] === '"' && code[i + 1] === '"') { i += 2; continue; }
            if (code[i] === '"') { abierto = false; i++; break; }
            i++;
          }
          if (!abierto && /[A-Za-z0-9\u00C0-\u00FF]/.test(code[i] || '')) malas.push(`${idx + 1}: ${l.trim()}`);
        }
        if (abierto) malas.push(`${idx + 1}: ${l.trim()}`);
      });
      expect(malas).toEqual([]);
    });
  }
});
