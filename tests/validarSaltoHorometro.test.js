import { describe, it, expect } from 'vitest';
import { validarSaltoHorometro } from '../logic.js';

// Inspirado en el control de "Report Mantención" del manual de Besalco Maquinarias
// (rechaza un horómetro fuera de ±50h del reporte diario anterior) — acá el margen
// escala con los días transcurridos y el ritmo nominal del equipo, porque el
// horómetro no se reporta todos los días como en ese sistema.
describe('validarSaltoHorometro', () => {
  it('sin dato previo (primera lectura del equipo) — siempre válido', () => {
    expect(validarSaltoHorometro(1000, null, null, '2026-08-06', 12)).toEqual({ valido: true });
  });

  it('avance plausible en un día (dentro de 4x el ritmo nominal) — válido', () => {
    // ritmo nominal 12h/día, avance de 20h en 1 día está dentro de 4x (48h)
    const r = validarSaltoHorometro(1020, 1000, '2026-08-05', '2026-08-06', 12);
    expect(r.valido).toBe(true);
  });

  it('avance implausible en un día (más de 4x el ritmo nominal) — inválido', () => {
    // ritmo nominal 12h/día, avance de 100h en 1 día excede 4x (48h)
    const r = validarSaltoHorometro(1100, 1000, '2026-08-05', '2026-08-06', 12);
    expect(r.valido).toBe(false);
    expect(r.motivo).toMatch(/avance/i);
  });

  it('el mismo avance grande SÍ es plausible si pasaron varios días', () => {
    // 100h de avance en 10 días = 10h/día, muy por debajo de 4x el ritmo nominal (48h/día)
    const r = validarSaltoHorometro(1100, 1000, '2026-07-27', '2026-08-06', 12);
    expect(r.valido).toBe(true);
  });

  it('horómetro menor al último registrado — inválido, sin importar los días', () => {
    const r = validarSaltoHorometro(900, 1000, '2026-08-01', '2026-08-06', 12);
    expect(r.valido).toBe(false);
    expect(r.motivo).toMatch(/menor/i);
  });

  it('fecha nueva anterior a la fecha del último dato (retroactivo) — no lo valida, queda a cargo de otra regla', () => {
    const r = validarSaltoHorometro(500, 1000, '2026-08-06', '2026-07-01', 12);
    expect(r.valido).toBe(true);
  });

  it('mismo día que el último dato — usa 1 día completo para el tope, no revienta con tope 0', () => {
    const r = validarSaltoHorometro(1015, 1000, '2026-08-06', '2026-08-06', 12);
    expect(r.valido).toBe(true); // 15h en el mismo día, dentro de 4x12=48
  });

  it('sin hrsDia del equipo (0 o ausente) — cae al nominal de 12h/día', () => {
    const rInvalido = validarSaltoHorometro(1200, 1000, '2026-08-05', '2026-08-06', 0);
    expect(rInvalido.valido).toBe(false); // 200h en 1 día excede 4x12=48
    const rValido = validarSaltoHorometro(1020, 1000, '2026-08-05', '2026-08-06', null);
    expect(rValido.valido).toBe(true);
  });

  it('equipo de mayor ritmo nominal (ej. camión 16h/día) admite un tope proporcionalmente mayor', () => {
    // 180h en 3 días = 60h/día, por debajo de 4x16=64h/día
    const r = validarSaltoHorometro(1180, 1000, '2026-08-03', '2026-08-06', 16);
    expect(r.valido).toBe(true);
  });
});
