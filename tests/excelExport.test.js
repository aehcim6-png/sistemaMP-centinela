import { describe, it, expect } from 'vitest';
import { excelValorCelda, excelNombreHoja, excelHojasDesdeTablas } from '../logic.js';

// Excel real (2-nov-2026): lo que se ve en una tabla pasa a hojas con números y fechas de verdad.
describe('excelValorCelda: número, fecha o texto', () => {
  it('números con formato chileno pasan a número', () => {
    expect(excelValorCelda('1.234')).toBe(1234);
    expect(excelValorCelda('1.234.567')).toBe(1234567);
    expect(excelValorCelda('1.234,5')).toBe(1234.5);
    expect(excelValorCelda('-12,5')).toBe(-12.5);
    expect(excelValorCelda('0,75')).toBe(0.75);
    expect(excelValorCelda('436018')).toBe(436018);
    expect(excelValorCelda(0)).toBe(0);
    expect(excelValorCelda('0')).toBe(0);
  });
  it('lo que podría perderse al convertir queda como texto', () => {
    expect(excelValorCelda('007')).toBe('007');                 // código o serie con ceros a la izquierda
    expect(excelValorCelda('1234567890123456')).toBe('1234567890123456'); // más de 15 dígitos
    expect(excelValorCelda('94,5%')).toBe('94,5%');
    expect(excelValorCelda('CA-5979')).toBe('CA-5979');
    expect(excelValorCelda('12 h')).toBe('12 h');
    expect(excelValorCelda('1.23')).toBe('1.23');               // punto sin miles de 3 dígitos: ambiguo, no se adivina
  });
  it('fechas pasan al número de serie de Excel con formato dd-mm-aaaa', () => {
    expect(excelValorCelda('2026-11-01')).toEqual({ t: 'n', v: 46327, z: 'dd-mm-yyyy' });
    expect(excelValorCelda('01-11-2026')).toEqual({ t: 'n', v: 46327, z: 'dd-mm-yyyy' });
    expect(excelValorCelda('1/11/2026')).toEqual({ t: 'n', v: 46327, z: 'dd-mm-yyyy' });
    expect(excelValorCelda('2026-01-01').v).toBe(46023);
  });
  it('una fecha imposible no se convierte', () => {
    expect(excelValorCelda('31-02-2026')).toBe('31-02-2026');
    expect(excelValorCelda('2026-13-01')).toBe('2026-13-01');
  });
  it('vacío y nulos dan celda vacía; un texto que empieza con = sigue siendo texto', () => {
    expect(excelValorCelda(null)).toBe('');
    expect(excelValorCelda(undefined)).toBe('');
    expect(excelValorCelda('   ')).toBe('');
    expect(excelValorCelda('=1+1')).toBe('=1+1');     // aoa_to_sheet lo guarda como texto, no como fórmula
    expect(excelValorCelda(NaN)).toBe('');
  });
});

describe('excelNombreHoja: nombre válido y sin repetir', () => {
  it('quita los caracteres prohibidos y corta a 31', () => {
    expect(excelNombreHoja('Costo [USD]: flota/2026?', [], 1)).toBe('Costo USD flota 2026');
    expect(excelNombreHoja('A'.repeat(50), [], 1)).toHaveLength(31);
  });
  it('sin título usa «Tabla n»', () => {
    expect(excelNombreHoja('', [], 3)).toBe('Tabla 3');
    expect(excelNombreHoja('   ', [], 2)).toBe('Tabla 2');
  });
  it('un nombre repetido (sin importar mayúsculas) recibe número', () => {
    expect(excelNombreHoja('Equipos', ['Equipos'], 1)).toBe('Equipos (2)');
    expect(excelNombreHoja('equipos', ['Equipos', 'Equipos (2)'], 1)).toBe('equipos (3)');
    expect(excelNombreHoja('B'.repeat(31), ['B'.repeat(31)], 1)).toHaveLength(31);
  });
});

describe('excelHojasDesdeTablas: hojas del libro', () => {
  const tabla = (titulo, filas) => ({ titulo, filas });
  it('cada tabla va a su hoja con números y fechas convertidos', () => {
    const h = excelHojasDesdeTablas([tabla('Equipos', [['Sigla', 'Horómetro', 'Fecha'], ['CA-5979', '124.127', '2026-11-01']])]);
    expect(h).toHaveLength(1);
    expect(h[0].nombre).toBe('Equipos');
    expect(h[0].filas[0]).toEqual(['Sigla', 'Horómetro', 'Fecha']);
    expect(h[0].filas[1][0]).toBe('CA-5979');
    expect(h[0].filas[1][1]).toBe(124127);
    expect(h[0].filas[1][2].v).toBe(46327);
  });
  it('las cifras de un tablero van primero en la hoja «Cifras»', () => {
    const h = excelHojasDesdeTablas([tabla('Detalle', [['a'], ['1']])], [{ etiqueta: 'Disponibilidad', valor: '94,5' }, { etiqueta: 'Sin valor', valor: '' }]);
    expect(h.map((x) => x.nombre)).toEqual(['Cifras', 'Detalle']);
    expect(h[0].filas).toEqual([['Indicador', 'Valor'], ['Disponibilidad', 94.5]]);
  });
  it('omite tablas vacías y filas totalmente vacías; nombres repetidos se numeran', () => {
    const h = excelHojasDesdeTablas([
      tabla('Plan', [['x', 'y'], ['', ''], ['1', '2']]),
      tabla('Plan', [['z']]),
      tabla('Vacía', []),
      tabla('Solo vacíos', [['', ' ']]),
    ]);
    expect(h.map((x) => x.nombre)).toEqual(['Plan', 'Plan (2)']);
    expect(h[0].filas).toHaveLength(2);
  });
  it('sin tablas ni cifras devuelve lista vacía', () => {
    expect(excelHojasDesdeTablas([], [])).toEqual([]);
    expect(excelHojasDesdeTablas(undefined, undefined)).toEqual([]);
  });
});
