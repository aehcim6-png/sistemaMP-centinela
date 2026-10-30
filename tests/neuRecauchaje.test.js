// Recauchaje de neumáticos (PRO-MAN-004): cuándo se puede enviar un casco, qué número de recauchaje le toca y el resumen de envíos, retornos y rechazos.
import { describe, it, expect } from 'vitest';
import { NEU_CODIGOS_RECHAZO, NEU_RECAUCHAJE_MAX_FORMULARIO, neuRecauchajesDe, neuSiguienteNumRecauchaje, neuPuedeEnviarRecauchaje, resumenRecauchajes } from '../logic.js';

const recs = [
  { serie: 'ABC1', estado: 'Recibido', fechaEnvio: '2026-01-10', fechaRetorno: '2026-01-30', huellaSalida: 12, huellaEntrada: 60, costo: 900000 },
  { serie: 'abc1 ', estado: 'Recibido', fechaEnvio: '2026-05-02', fechaRetorno: '2026-05-12', huellaSalida: 14, huellaEntrada: 58 },
  { serie: 'XYZ9', estado: 'Rechazado', fechaEnvio: '2026-03-01', fechaRetorno: '2026-03-15', codigoRechazo: 'F06' },
  { serie: 'QQ7', estado: 'Rechazado', fechaEnvio: '2026-04-01', fechaRetorno: '2026-04-05', codigoRechazo: 'F06' },
  { serie: 'KK3', estado: 'Rechazado', fechaEnvio: '2026-04-03', fechaRetorno: '2026-04-09', codigoRechazo: 'T01' },
  { serie: 'MM5', estado: 'Enviado', fechaEnvio: '2026-10-20' },
  { serie: 'OLD', estado: 'Recibido', fechaEnvio: '2025-12-01', fechaRetorno: '2025-12-20', huellaSalida: 10, huellaEntrada: 55, costo: 500000 },
];

describe('neuRecauchajesDe y neuSiguienteNumRecauchaje', () => {
  it('reúne los envíos por serie sin importar mayúsculas ni espacios, en orden', () => {
    expect(neuRecauchajesDe('ABC1', recs).map((r) => r.fechaEnvio)).toEqual(['2026-01-10', '2026-05-02']);
  });
  it('el siguiente número es recibidos + 1', () => {
    expect(neuSiguienteNumRecauchaje('ABC1', recs)).toBe(3);
    expect(neuSiguienteNumRecauchaje('NUEVO', recs)).toBe(1);
  });
});

describe('neuPuedeEnviarRecauchaje', () => {
  it('un neumático en Stock o de baja se puede enviar', () => {
    expect(neuPuedeEnviarRecauchaje({ serie: 'ABC1', estado: 'Stock' }, recs)).toEqual({ ok: true, numSiguiente: 3, sobreMaximo: false });
    expect(neuPuedeEnviarRecauchaje({ serie: 'NEW', estado: 'Baja Desgaste' }, recs).ok).toBe(true);
  });
  it('montado, ya enviado, rechazado antes o sin serie: no', () => {
    expect(neuPuedeEnviarRecauchaje({ serie: 'NEW', estado: 'Operativo' }, recs).motivo).toContain('retirarlo del equipo');
    expect(neuPuedeEnviarRecauchaje({ serie: 'NEW' }, recs).ok).toBe(false);                       // sin estado = Operativo
    expect(neuPuedeEnviarRecauchaje({ serie: 'MM5', estado: 'Stock' }, recs).motivo).toBe('Ya está en recauchaje');
    expect(neuPuedeEnviarRecauchaje({ serie: 'XYZ9', estado: 'De baja' }, recs).motivo).toBe('El proveedor ya rechazó este casco');
    expect(neuPuedeEnviarRecauchaje({ serie: ' ', estado: 'Stock' }, recs).ok).toBe(false);
  });
  it('pasado el 4.º recauchaje avisa pero no bloquea', () => {
    const cuatro = [1, 2, 3, 4].map((k) => ({ serie: 'S4', estado: 'Recibido', fechaEnvio: `2026-0${k}-01` }));
    expect(NEU_RECAUCHAJE_MAX_FORMULARIO).toBe(4);
    expect(neuPuedeEnviarRecauchaje({ serie: 'S4', estado: 'Stock' }, cuatro)).toEqual({ ok: true, numSiguiente: 5, sobreMaximo: true });
  });
});

describe('resumenRecauchajes', () => {
  const r = resumenRecauchajes(recs, '2026-01-01', '2026-12-31');
  it('cuenta envíos del período y la tasa de aprobación sobre los que volvieron', () => {
    expect(r.enviados).toBe(6);
    expect(r.enProceso).toBe(1);
    expect(r.recibidos).toBe(2);
    expect(r.rechazados).toBe(3);
    expect(r.tasaAprobacion).toBe(40);
  });
  it('días de vuelta, huella ganada y costo', () => {
    expect(r.diasRetornoProm).toBe(10.8);   // (20 + 10 + 14 + 4 + 6) / 5
    expect(r.ganadoMmProm).toBe(46);        // (48 + 44) / 2
    expect(r.costoTotal).toBe(900000);
    expect(r.sinCosto).toBe(1);
  });
  it('rechazos por código con su descripción, el más frecuente primero', () => {
    expect(r.porCodigo).toEqual([{ cod: 'F06', desc: 'Daño lateral', n: 2 }, { cod: 'T01', desc: 'Talones rotos', n: 1 }]);
  });
  it('sin retornos: tasa vacía, no 0', () => {
    expect(resumenRecauchajes([{ serie: 'A', estado: 'Enviado', fechaEnvio: '2026-10-01' }]).tasaAprobacion).toBeNull();
  });
  it('los once códigos del formulario, sin repetir', () => {
    expect(NEU_CODIGOS_RECHAZO).toHaveLength(11);
    expect(new Set(NEU_CODIGOS_RECHAZO.map((c) => c.cod)).size).toBe(11);
  });
});
