import { describe, it, expect } from 'vitest';
import { resolverDestrabePorOC } from '../logic.js';

// Inspirado en el manual OTR de Besalco Maquinarias: la OT ligada a un PI/OC se
// cierra sola cuando la compra llega. Acá el equivalente es la fila de Gestión de
// Destrabe bloqueada por falta de repuesto (ver destrabe.js/rep.js).
describe('resolverDestrabePorOC', () => {
  it('resuelve la fila de destrabe vinculada a la OC recibida', () => {
    const destrabe = [
      { equipo: 'CN-9507', trabajo: 'Cambio bomba', estado: 'Bloqueado', accion: '', idOrdenCompra: 'oc-1' },
    ];
    const r = resolverDestrabePorOC(destrabe, 'oc-1', '2026-08-10');
    expect(r[0].estado).toBe('Resuelto');
    expect(r[0].accion).toMatch(/auto.*2026-08-10/);
  });

  it('no toca filas vinculadas a otra OC', () => {
    const destrabe = [
      { equipo: 'CN-9507', estado: 'Bloqueado', accion: '', idOrdenCompra: 'oc-1' },
      { equipo: 'CN-9503', estado: 'Bloqueado', accion: '', idOrdenCompra: 'oc-2' },
    ];
    const r = resolverDestrabePorOC(destrabe, 'oc-1', '2026-08-10');
    expect(r[0].estado).toBe('Resuelto');
    expect(r[1].estado).toBe('Bloqueado');
  });

  it('resuelve TODAS las filas vinculadas a la misma OC (más de un bloqueo esperando el mismo repuesto)', () => {
    const destrabe = [
      { equipo: 'CN-9507', estado: 'Bloqueado', accion: '', idOrdenCompra: 'oc-1' },
      { equipo: 'CN-9508', estado: 'En Gestión', accion: '', idOrdenCompra: 'oc-1' },
    ];
    const r = resolverDestrabePorOC(destrabe, 'oc-1', '2026-08-10');
    expect(r.every(d => d.estado === 'Resuelto')).toBe(true);
  });

  it('no toca una fila ya Resuelta (no la duplica ni le agrega una segunda nota)', () => {
    const destrabe = [
      { equipo: 'CN-9507', estado: 'Resuelto', accion: 'Se resolvió a mano', idOrdenCompra: 'oc-1' },
    ];
    const r = resolverDestrabePorOC(destrabe, 'oc-1', '2026-08-10');
    expect(r[0].accion).toBe('Se resolvió a mano');
  });

  it('conserva la nota de acción previa, agregando la automática a continuación', () => {
    const destrabe = [
      { equipo: 'CN-9507', estado: 'En Gestión', accion: 'Proveedor confirmó despacho', idOrdenCompra: 'oc-1' },
    ];
    const r = resolverDestrabePorOC(destrabe, 'oc-1', '2026-08-10');
    expect(r[0].accion).toBe('Proveedor confirmó despacho — (auto) Repuesto recibido 2026-08-10');
  });

  it('filas sin idOrdenCompra (no vinculadas) quedan intactas', () => {
    const destrabe = [{ equipo: 'CN-9507', estado: 'Bloqueado', accion: '', idOrdenCompra: null }];
    const r = resolverDestrabePorOC(destrabe, 'oc-1', '2026-08-10');
    expect(r[0].estado).toBe('Bloqueado');
  });

  it('sin idOrdenCompra recibido (parámetro vacío) devuelve el arreglo tal cual', () => {
    const destrabe = [{ equipo: 'CN-9507', estado: 'Bloqueado', idOrdenCompra: 'oc-1' }];
    expect(resolverDestrabePorOC(destrabe, null, '2026-08-10')).toBe(destrabe);
  });

  it('arreglo vacío o inválido no revienta', () => {
    expect(resolverDestrabePorOC([], 'oc-1', '2026-08-10')).toEqual([]);
    expect(resolverDestrabePorOC(null, 'oc-1', '2026-08-10')).toBe(null);
  });
});
