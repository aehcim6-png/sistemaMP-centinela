// El inventario de algoritmos (docs/inventario-algoritmos.md) debe mencionar TODAS las funciones exportadas de logic.js, y cada ficha de las secciones A a J y L debe declarar de dónde viene el método.
// Si falla: agregá la ficha (o la fila del apéndice M) del cálculo nuevo. Ver "Cómo se mantiene al día este inventario" al final del documento.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const raiz = path.resolve(__dirname, '..');
const doc = fs.readFileSync(path.join(raiz, 'docs/inventario-algoritmos.md'), 'utf8');
const logic = fs.readFileSync(path.join(raiz, 'logic.js'), 'utf8');

function exportadas() {
  const m = logic.match(/module\.exports\s*=\s*\{([\s\S]*?)\};?\s*\}/);
  return [...new Set(m[1].split(/[,\s]+/).map((s) => s.trim()).filter((s) => /^[A-Za-z_]\w*$/.test(s)))];
}

function fichas() {
  const trozos = doc.split(/\n(?=### [A-M]\d+\. )/).slice(1);
  return trozos.map((t) => ({ id: t.match(/^### ([A-M]\d+)\./)[1], texto: t.split('\n---')[0] }));
}

describe('inventario de algoritmos', () => {
  it('menciona todas las funciones exportadas de logic.js', () => {
    const sinFicha = exportadas().filter((n) => !doc.includes(n));
    expect(sinFicha).toEqual([]);
  });

  it('cada ficha de las secciones A a J y L dice de dónde viene el método, con su nivel de fuente', () => {
    const malas = fichas()
      .filter((f) => /^[A-JL]/.test(f.id))
      .filter((f) => !/\*\*De dónde viene:\*\*\s*(🟢|🟡|🔵|⚪|📄)/.test(f.texto))
      .map((f) => f.id);
    expect(malas).toEqual([]);
  });

  it('cada ficha de las secciones A a J y L indica en qué parte del código está', () => {
    const malas = fichas()
      .filter((f) => /^[A-JL]/.test(f.id))
      .filter((f) => !/\*\*Código:\*\*/.test(f.texto))
      .map((f) => f.id);
    expect(malas).toEqual([]);
  });

  it('las fichas no están duplicadas y el índice de cada sección es consecutivo', () => {
    const ids = fichas().map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const porLetra = {};
    ids.forEach((id) => { (porLetra[id[0]] = porLetra[id[0]] || []).push(Number(id.slice(1))); });
    Object.values(porLetra).forEach((nums) => expect(nums).toEqual(nums.map((_, i) => i + 1)));
  });

  it('todos los enlaces son https', () => {
    const enlaces = [...doc.matchAll(/\]\((http[^)\s]+)\)/g)].map((m) => m[1]);
    expect(enlaces.length).toBeGreaterThan(50);
    expect(enlaces.filter((u) => !u.startsWith('https://'))).toEqual([]);
  });
});
