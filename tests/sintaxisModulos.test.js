import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

// Los módulos de modules/ se cargan bajo demanda en el navegador y `vite build` no los revisa: un error de sintaxis solo se
// descubre cuando alguien abre la pestaña (servidor responde 500 al importar el módulo). Esta prueba los analiza todos con `node --check`.
const raiz = path.resolve(__dirname, '..');
const archivos = [];
(function recorrer(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(p);
    else if (e.name.endsWith('.js')) archivos.push(p);
  });
})(path.join(raiz, 'modules'));
archivos.push(path.join(raiz, 'logic.js'));

describe('sintaxis de los módulos que se cargan bajo demanda', () => {
  it('hay módulos que revisar', () => { expect(archivos.length).toBeGreaterThan(40); });
  archivos.forEach((f) => {
    it(path.relative(raiz, f), () => {
      const tmp = path.join(os.tmpdir(), 'chk_' + Math.random().toString(36).slice(2) + '.mjs');
      fs.writeFileSync(tmp, fs.readFileSync(f, 'utf8'));
      const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
      fs.unlinkSync(tmp);
      expect(r.status === 0 ? '' : r.stderr.split('\n').slice(0, 4).join('\n')).toBe('');
    });
  });
});
