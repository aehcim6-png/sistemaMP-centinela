import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Guardia estática de la revisión cruzada de coherencia (2026-10-14): una "falla" se cuenta con 3 fuentes (correctivos, historial 2022-2025 e informes de falla
// catastrófica). Si una pantalla suma solo algunas, su MTBF, sus fallas o su ratio preventivo dan distinto que en las demás sin que nada lo avise.
// Metas y Componentes Mayores sumaban solo 2 de las 3 hasta esta revisión. La prueba de navegador tests/e2e/coherencia-cruzada.spec.js compara los
// números que se ven; esta atrapa el mismo error en pantallas que esa comparación no abre.
const dir = path.join(__dirname, '..', 'modules', 'renders');
const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
const leer = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
// quita comentarios de línea para no contar menciones en texto
const codigo = (t) => t.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// Pantallas que a propósito NO suman los informes de falla, con el motivo.
const SIN_INFORMES = {
  'informes.js': 'es el propio informe de falla: usa solo OT reales como "Orden" para no cruzarse consigo mismo (ver su comentario)',
};

describe('coherencia entre pantallas: fuentes de fallas', () => {
  it('toda pantalla que suma el historial de correctivos suma también los informes de falla catastrófica', () => {
    const sospechosas = archivos.filter((f) => {
      const c = codigo(leer(f));
      return /_otHistComoOt\(/.test(c) && !/_informesFallaComoOt\(/.test(c) && !SIN_INFORMES[f];
    });
    expect(sospechosas, 'suman ot + historial pero no informes de falla').toEqual([]);
  });

  it('toda llamada a _estFallasCombinadas pasa las 3 fuentes (ot, historial, informes)', () => {
    const malas = [];
    archivos.forEach((f) => {
      const c = codigo(leer(f));
      const re = /_estFallasCombinadas\(/g; let m;
      while ((m = re.exec(c))) {
        if (/function\s+$/.test(c.slice(Math.max(0, m.index - 12), m.index))) continue;
        let prof = 1, i = m.index + m[0].length, comas = 0;
        for (; i < c.length && prof > 0; i++) {
          const ch = c[i];
          if (ch === '(' || ch === '[' || ch === '{') prof++;
          else if (ch === ')' || ch === ']' || ch === '}') prof--;
          else if (ch === ',' && prof === 1) comas++;
        }
        if (comas < 2) malas.push(f + ': ' + c.slice(m.index, Math.min(i, m.index + 90)).replace(/\s+/g, ' '));
      }
    });
    expect(malas, 'llamadas con menos de 3 fuentes').toEqual([]);
  });
});
