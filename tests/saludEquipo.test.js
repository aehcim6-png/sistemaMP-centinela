import { describe, it, expect } from 'vitest';
import { scoreSaludEquipo, motivoPrincipalSalud } from '../logic.js';

describe('scoreSaludEquipo', () => {
  it('devuelve null si no hay ninguna dimensión con dato', () => {
    const r = scoreSaludEquipo({});
    expect(r.valor).toBeNull();
    expect(r.n).toBe(0);
  });

  it('promedia las 4 dimensiones cuando todas tienen dato', () => {
    const r = scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 80, aceitePct: 60, confiabilidadPct: 100 });
    expect(r.valor).toBe(85);
    expect(r.n).toBe(4);
  });

  it('promedia solo las dimensiones disponibles, sin inventar las que faltan', () => {
    // Caso real: equipo sin muestras de aceite y sin 2 fallas registradas
    // (así que no hay MTBF) — solo componentes y neumáticos tienen dato.
    const r = scoreSaludEquipo({ componentesPct: 90, neumaticosPct: 70, aceitePct: null, confiabilidadPct: null });
    expect(r.valor).toBe(80);
    expect(r.n).toBe(2);
  });

  it('el detalle trae las 4 dimensiones con su nombre, tenga dato o no', () => {
    const r = scoreSaludEquipo({ componentesPct: 90 });
    expect(r.detalle.map(c => c.nombre)).toEqual(['Componentes', 'Neumáticos', 'Aceite', 'Confiabilidad']);
    expect(r.detalle.find(c => c.nombre === 'Aceite').valor).toBeNull();
  });

  it('redondea a un decimal', () => {
    const r = scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 66, confiabilidadPct: null, aceitePct: null });
    expect(r.valor).toBe(83);
  });

  it('un equipo perfecto en las 4 dimensiones da 100', () => {
    const r = scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 100, aceitePct: 100, confiabilidadPct: 100 });
    expect(r.valor).toBe(100);
  });

  it('ignora valores no numéricos (undefined, NaN, string) como si faltara el dato', () => {
    const r = scoreSaludEquipo({ componentesPct: 80, neumaticosPct: 60, aceitePct: NaN, confiabilidadPct: '50' });
    expect(r.valor).toBe(70);
    expect(r.n).toBe(2);
  });

  it('con una sola señal con dato el equipo queda «sin datos suficientes» (valor null), no crítico ni sano (24-nov-2026)', () => {
    const r = scoreSaludEquipo({ confiabilidadPct: 0 });
    expect(r.valor).toBeNull();
    expect(r.n).toBe(1);
    expect(r.insuficiente).toBe(true);
    expect(r.detalle.find(c => c.nombre === 'Confiabilidad').valor).toBe(0);   // el detalle se conserva
    expect(scoreSaludEquipo({ confiabilidadPct: 0, componentesPct: 100 }).valor).toBe(50);   // con dos señales ya hay nota
  });
});

describe('motivoPrincipalSalud', () => {
  it('devuelve null si el detalle está vacío', () => {
    expect(motivoPrincipalSalud([])).toBeNull();
  });

  it('devuelve null si ninguna dimensión tiene dato', () => {
    const detalle = [{ nombre: 'Componentes', valor: null }, { nombre: 'Aceite', valor: null }];
    expect(motivoPrincipalSalud(detalle)).toBeNull();
  });

  it('elige la dimensión de valor más bajo entre las que tienen dato', () => {
    const detalle = [
      { nombre: 'Componentes', valor: 40 },
      { nombre: 'Neumáticos', valor: 90 },
      { nombre: 'Aceite', valor: null },
      { nombre: 'Confiabilidad', valor: 70 },
    ];
    expect(motivoPrincipalSalud(detalle)).toEqual({ nombre: 'Componentes', valor: 40 });
  });

  it('ignora las dimensiones sin dato al elegir la peor', () => {
    const detalle = [
      { nombre: 'Componentes', valor: null },
      { nombre: 'Neumáticos', valor: 55 },
      { nombre: 'Aceite', valor: 60 },
    ];
    expect(motivoPrincipalSalud(detalle)?.nombre).toBe('Neumáticos');
  });
});

describe('reglas de medición del Score de Salud (24-nov-2026)', () => {
  const { saludAceitePct, saludConfiabilidadPct, aceiteComponenteClave, claseOTDesdeTexto, esFallaMTBF } = require('../logic.js');
  const hoy = '2026-11-24';
  it('aceite: precaución vale la mitad, alerta cero, normal uno', () => {
    expect(saludAceitePct([{ fecha: '2026-11-01', componente: 'MOTOR', estado: 'NORMAL' }, { fecha: '2026-11-01', componente: 'TRANSMISION', estado: 'PRECAUCION' }, { fecha: '2026-11-01', componente: 'HIDRAULICO', estado: 'ALERTA' }], hoy)).toBe(50);
  });
  it('aceite: una muestra de más de 90 días no cuenta; sin muestras recientes no hay dato', () => {
    expect(saludAceitePct([{ fecha: '2026-07-10', componente: 'MOTOR', estado: 'ALERTA' }], hoy)).toBeNull();
    expect(saludAceitePct([{ fecha: '2026-07-10', componente: 'MOTOR', estado: 'ALERTA' }, { fecha: '2026-11-10', componente: 'TRANSMISION', estado: 'NORMAL' }], hoy)).toBe(100);
  });
  it('aceite: un componente mal escrito (HIRAULICO) cuenta como el mismo y manda la muestra más nueva', () => {
    expect(aceiteComponenteClave('hiraulico')).toBe('HIDRAULICO');
    expect(saludAceitePct([{ fecha: '2026-11-01', componente: 'HIDRAULICO', estado: 'PRECAUCION' }, { fecha: '2026-11-02', componente: 'HIRAULICO', estado: 'NORMAL' }], hoy)).toBe(100);
  });
  it('confiabilidad: con menos de 3 fallas no hay dato (dos fallas a 26 h de distancia ya no dan 0 %)', () => {
    expect(saludConfiabilidadPct([5616, 5642], 12)).toBeNull();
    expect(saludConfiabilidadPct([100, 400, 700], 12)).not.toBeNull();
  });
  it('clasificación: instalar focos solares, un ítem de Backlog y un golpe de parachoques no son fallas', () => {
    expect(claseOTDesdeTexto('instalación focos solares')).toBe('instalacion');
    expect(claseOTDesdeTexto('Backlog: revisar soporte de la cámara de fatiga y somnolencia')).toBe('preventiva');
    expect(claseOTDesdeTexto('Golpe en parachoques y cañeria')).toBe('operacional');
    expect(esFallaMTBF({ tipo: 'Correctivo', sintoma: 'instalación focos solares', horom: 562 })).toBe(false);
  });
  it('lo que sí es falla sigue siéndolo (golpeteo de motor, falla de focos, cañería dañada)', () => {
    expect(claseOTDesdeTexto('Golpeteo en motor')).toBe('correctiva');
    expect(claseOTDesdeTexto('Falla de focos de trabajo')).toBe('correctiva');
    expect(claseOTDesdeTexto('Cañería dañada')).toBe('correctiva');
  });
});
