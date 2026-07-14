const { C } = require('../logic.js');

describe('C.tipoPM — clasificación de PM por horómetro', () => {
  it('múltiplo de 2000 -> PM4', () => {
    expect(C.tipoPM(2000)).toBe('PM4');
    expect(C.tipoPM(4000)).toBe('PM4');
  });
  it('múltiplo de 1000 (no de 2000) -> PM3', () => {
    expect(C.tipoPM(1000)).toBe('PM3');
    expect(C.tipoPM(3000)).toBe('PM3');
  });
  it('múltiplo de 500 (no de 1000) -> PM2', () => {
    expect(C.tipoPM(500)).toBe('PM2');
    expect(C.tipoPM(1500)).toBe('PM2');
  });
  it('cualquier otro valor -> PM1', () => {
    expect(C.tipoPM(250)).toBe('PM1');
    expect(C.tipoPM(1)).toBe('PM1');
    expect(C.tipoPM(0)).toBe('PM4'); // 0 es múltiplo de todo — caso límite real del código
  });
});

describe('C.proxPM — próximo múltiplo de la frecuencia', () => {
  it('redondea hacia arriba al múltiplo más cercano', () => {
    expect(C.proxPM(240, 250)).toBe(250);
    expect(C.proxPM(250, 250)).toBe(250);
    expect(C.proxPM(251, 250)).toBe(500);
  });
  it('usa 250 como frecuencia por defecto', () => {
    expect(C.proxPM(100)).toBe(250);
  });
});

describe('C.estado — clasificación de urgencia por días restantes', () => {
  it('días negativos -> VENCIDA', () => {
    expect(C.estado(-1).t).toBe('VENCIDA');
  });
  it('0 días -> URGENTE (límite inferior)', () => {
    expect(C.estado(0).t).toBe('URGENTE');
  });
  it('7 días -> URGENTE (límite superior de la banda)', () => {
    expect(C.estado(7).t).toBe('URGENTE');
  });
  it('8 días -> PRÓXIMA (justo pasado el límite de URGENTE)', () => {
    expect(C.estado(8).t).toBe('PRÓXIMA');
  });
  it('30 días -> PRÓXIMA (límite superior de la banda)', () => {
    expect(C.estado(30).t).toBe('PRÓXIMA');
  });
  it('31 días -> AL DÍA', () => {
    expect(C.estado(31).t).toBe('AL DÍA');
  });
});

describe('C.alertaPM4 — clasificación de urgencia para overhaul (2000h)', () => {
  it('menos de 250h -> URGENTE', () => {
    expect(C.alertaPM4(0).t).toContain('URGENTE');
    expect(C.alertaPM4(249).t).toContain('URGENTE');
  });
  it('250h exacto -> ya no es URGENTE, pasa a PRÓXIMA', () => {
    expect(C.alertaPM4(250).t).toContain('PRÓXIMA');
  });
  it('999h -> PLANIFICAR', () => {
    expect(C.alertaPM4(999).t).toBe('PLANIFICAR');
  });
  it('1000h exacto -> ya no es PLANIFICAR, pasa a OK', () => {
    expect(C.alertaPM4(1000).t).toContain('OK');
  });
});

describe('C.recalc — recalcula el estado completo de un equipo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calcula horas y días restantes hasta el próximo PM', () => {
    const e = { horomActual: 480, frecPM: 500, hrsDia: 20 };
    C.recalc(e);
    expect(e.horomProxPM).toBe(500);
    expect(e.hrsRestantes).toBe(20);
    expect(e.diasParaPM).toBe(1);
    expect(e.tipoPM).toBe('PM2');
  });
  it('con hrsDia en 0 usa el centinela de 999 días (evita división por cero)', () => {
    const e = { horomActual: 100, frecPM: 250, hrsDia: 0 };
    C.recalc(e);
    expect(e.diasParaPM).toBe(999);
  });
  it('proyecta fechaProxPM sumando los días restantes a hoy', () => {
    const e = { horomActual: 10, frecPM: 260, hrsDia: 25 };
    C.recalc(e);
    // próximo PM en 260h, quedan 250h; a 25h/día son 10 días desde 2026-07-14
    expect(e.fechaProxPM).toBe('2026-07-24');
  });
});
