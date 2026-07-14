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

describe('C.horomHistorico — horómetro reconstruido desde historial_horometros', () => {
  const hist = [
    { sigla: 'CF-8769', fecha: '2026-05-10', horomFin: 12000 },
    { sigla: 'CF-8769', fecha: '2026-05-20', horomFin: 12200 },
    { sigla: 'CF-8769', fecha: '2026-06-01', horom: 12400 }, // sin horomFin, cae a horom
    { sigla: 'MN-5926', fecha: '2026-05-15', horomFin: 8000 },
  ];
  it('toma el registro más reciente con fecha <= fechaLimite', () => {
    expect(C.horomHistorico(hist, 'CF-8769', '2026-05-25')).toBe(12200);
  });
  it('usa horomFin si existe; si no, cae a horom', () => {
    expect(C.horomHistorico(hist, 'CF-8769', '2026-06-01')).toBe(12400);
  });
  it('sin ningún registro <= fechaLimite para ese equipo -> null (no inventa un número)', () => {
    expect(C.horomHistorico(hist, 'CF-8769', '2026-05-01')).toBeNull();
  });
  it('equipo sin ningún registro en el historial -> null', () => {
    expect(C.horomHistorico(hist, 'BD-9509', '2026-06-01')).toBeNull();
  });
});

describe('C.estadoPeriodo — estado de un equipo reconstruido/proyectado para un mes distinto al actual', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('mismo mes que hoy -> usa horomActual en vivo (fuente "vivo")', () => {
    const e = { sigla: 'CF-8769', horomActual: 14143, frecPM: 250, hrsDia: 20 };
    const r = C.estadoPeriodo(e, [], '2026-07-14', '2026-07-31');
    expect(r.fuente).toBe('vivo');
    expect(r.horom).toBe(14143);
  });
  it('mes pasado con dato histórico -> reconstruye desde hist (fuente "historico")', () => {
    const hist = [{ sigla: 'CF-8769', fecha: '2026-05-31', horomFin: 12250 }];
    const e = { sigla: 'CF-8769', horomActual: 14143, frecPM: 250, hrsDia: 20 };
    const r = C.estadoPeriodo(e, hist, '2026-07-14', '2026-05-31');
    expect(r.fuente).toBe('historico');
    expect(r.horom).toBe(12250);
    // 12250 es múltiplo exacto de 250 -> 0 días restantes -> URGENTE
    expect(r.t).toBe('URGENTE');
  });
  it('mes pasado sin ningún dato histórico -> null, no inventa nada', () => {
    const e = { sigla: 'CF-8769', horomActual: 14143, frecPM: 250, hrsDia: 20 };
    const r = C.estadoPeriodo(e, [], '2026-07-14', '2026-05-31');
    expect(r).toBeNull();
  });
  it('mes futuro -> proyecta horomActual + hrsDia × días restantes (fuente "proyectado")', () => {
    const e = { sigla: 'CF-8769', horomActual: 14143, frecPM: 250, hrsDia: 20 };
    // 2026-07-14 -> 2026-08-31: 48 días
    const r = C.estadoPeriodo(e, [], '2026-07-14', '2026-08-31');
    expect(r.fuente).toBe('proyectado');
    expect(r.horom).toBe(14143 + 20 * 48);
  });
});
