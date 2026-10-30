// Traslado de neumáticos entre equipos / canibalización (PRO-MAN-004): qué se valida, qué posiciones donantes siguen vacías y el resumen por causal.
import { describe, it, expect } from 'vitest';
import { NEU_CAUSALES_TRASLADO, neuValidarTraslado, neuTrasladosPendientesReposicion, resumenTraslados } from '../logic.js';

describe('neuValidarTraslado', () => {
  const montado = { sigla: 'CA-1', serie: 'F-101', estado: 'Operativo' };
  it('un neumático montado a otro equipo, con posición y causal, se puede trasladar', () => {
    expect(neuValidarTraslado(montado, 'CA-2', 'Trasera Izq', 'Proveedor sin stock', '')).toEqual({ ok: true });
    expect(neuValidarTraslado({ sigla: 'CA-1', serie: 'F-1' }, 'CA-2', 'Del', 'Siniestro')).toEqual({ ok: true });   // sin estado = Operativo
  });
  it('rechaza lo que no corresponde, con el motivo', () => {
    expect(neuValidarTraslado({ ...montado, estado: 'Stock' }, 'CA-2', 'Del', 'Siniestro').motivo).toContain('Instalar desde Existencias');
    expect(neuValidarTraslado(montado, '', 'Del', 'Siniestro').motivo).toBe('Elige el equipo receptor');
    expect(neuValidarTraslado(montado, 'CA-1', 'Del', 'Siniestro').motivo).toContain('debe ser otro equipo');
    expect(neuValidarTraslado(montado, 'CA-2', ' ', 'Siniestro').motivo).toBe('Indica la posición en el receptor');
    expect(neuValidarTraslado(montado, 'CA-2', 'Del', 'Porque sí').motivo).toBe('Elige la causal');
    expect(neuValidarTraslado(montado, 'CA-2', 'Del', 'Otro', '').motivo).toContain('explica el motivo');
    expect(neuValidarTraslado(montado, 'CA-2', 'Del', 'Otro', 'Prueba de terreno').ok).toBe(true);
  });
  it('las causales son las del formulario corporativo', () => {
    expect(NEU_CAUSALES_TRASLADO).toEqual(['Retraso en pedido', 'Proveedor sin stock', 'Siniestro', 'Otro']);
  });
});

describe('neuTrasladosPendientesReposicion', () => {
  const tras = [
    { serie: 'F-1', fecha: '2026-10-10', donante: 'CA-1', posicionDonante: 'Trasera Izq', receptor: 'CA-2', causal: 'Proveedor sin stock' },
    { serie: 'F-2', fecha: '2026-10-20', donante: 'AL-1', posicionDonante: 'Delantera Der', receptor: 'AL-2', causal: 'Siniestro' },
    { serie: 'F-3', fecha: '2026-10-25', donante: 'CA-3', posicionDonante: '', receptor: 'CA-4', causal: 'Otro' },   // sin posición: no se puede saber
    { serie: 'F-4', fecha: '2026-09-01', donante: 'CA-1', posicionDonante: 'trasera izq', receptor: 'CA-5', causal: 'Retraso en pedido' },
  ];
  const neu = [
    { sigla: 'AL-1', posicion: 'Delantera Der', estado: 'Operativo' },    // AL-1 ya se repuso
    { sigla: 'CA-1', posicion: 'Trasera Izq', estado: 'Stock' },          // en Stock no cuenta como montado
  ];
  it('lista las posiciones donantes que siguen sin neumático montado, una por posición, con el traslado más reciente', () => {
    expect(neuTrasladosPendientesReposicion(tras, neu, '2026-10-30')).toEqual([
      { donante: 'CA-1', posicion: 'Trasera Izq', fecha: '2026-10-10', serie: 'F-1', receptor: 'CA-2', causal: 'Proveedor sin stock', dias: 20 },
    ]);
  });
  it('sin traslados: nada pendiente', () => {
    expect(neuTrasladosPendientesReposicion([], neu, '2026-10-30')).toEqual([]);
  });
});

describe('resumenTraslados', () => {
  it('cuenta por causal y por equipo donante dentro del período', () => {
    const r = resumenTraslados([
      { fecha: '2026-03-01', donante: 'CA-1', causal: 'Proveedor sin stock' },
      { fecha: '2026-05-01', donante: 'CA-1', causal: 'Proveedor sin stock' },
      { fecha: '2026-06-01', donante: 'AL-1', causal: 'Siniestro' },
      { fecha: '2025-12-01', donante: 'AL-1', causal: 'Siniestro' },
    ], '2026-01-01', '2026-12-31');
    expect(r.total).toBe(3);
    expect(r.porCausal).toEqual([{ causal: 'Proveedor sin stock', n: 2 }, { causal: 'Siniestro', n: 1 }]);
    expect(r.porDonante[0]).toEqual({ sigla: 'CA-1', n: 2 });
  });
});
