// La descripción completa del pedido (descripcionPedido, 23-nov-2026) sirve de respaldo para clasificar líneas cuyo detalle viene recortado a 25 caracteres.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const L = createRequire(import.meta.url)('../logic.js');

describe('tboFamiliaDeCompra con descripción del pedido', () => {
  it('no cambia lo que el detalle ya reconoce', () => {
    const sin = L.tboFamiliaDeCompra('Orbitrol (dirección)', null);
    const con = L.tboFamiliaDeCompra('Orbitrol (dirección)', null, 'Servicio de traslado orbitrol Alto Hospicio a Sierra Gorda');
    expect(con).toEqual(sin);
  });
  it('usa la descripción del pedido cuando el detalle no se reconoce', () => {
    const detalle = 'Zzzzz qqqq 12345';
    expect(L.tboFamiliaDeCompra(detalle, null).id).toBe('otros');
    const con = L.tboFamiliaDeCompra(detalle, null, 'Orbitrol de dirección Komatsu');
    expect(con.id).not.toBe('otros');
  });
  it('no reclasifica los servicios con la descripción del pedido', () => {
    expect(L.tboFamiliaDeCompra('Zzzzz qqqq 12345', 'Servicio', 'Orbitrol de dirección').id).toBe('servicios');
  });
  it('sin descripción se comporta como antes', () => {
    expect(L.tboFamiliaDeCompra('Zzzzz qqqq 12345', null, '').id).toBe('otros');
    expect(L.tboFamiliaDeCompra('Zzzzz qqqq 12345', null, null).id).toBe('otros');
  });
});
