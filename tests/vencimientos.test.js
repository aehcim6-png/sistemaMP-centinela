const { vencReglaDefault, vencCalcProximo, vencEstado } = require('../logic.js');

describe('vencReglaDefault — periodicidad por tipo de equipo y tipo de vencimiento', () => {
  it('Sistema AFEX: 6 meses para CAEX, Bulldozer y Cargador', () => {
    expect(vencReglaDefault('CAEX', 'Sistema AFEX')).toBe(6);
    expect(vencReglaDefault('Bulldozer', 'Sistema AFEX')).toBe(6);
    expect(vencReglaDefault('Cargador Frontal', 'Sistema AFEX')).toBe(6);
  });
  it('Sistema AFEX: 6 meses para "Camion" — el tipo real de los camiones mineros en los datos (nunca "CAEX")', () => {
    expect(vencReglaDefault('Camion', 'Sistema AFEX')).toBe(6);
    expect(vencReglaDefault('Camion Aljibe', 'Sistema AFEX')).toBe(6);
  });
  it('Sistema AFEX: sin regla para una Camioneta', () => {
    expect(vencReglaDefault('Camioneta', 'Sistema AFEX')).toBeNull();
  });
  it('Revisión Técnica: 6 meses para Aljibe/Bus, 12 para Camioneta', () => {
    expect(vencReglaDefault('Aljibe', 'Revisión Técnica')).toBe(6);
    expect(vencReglaDefault('Bus', 'Revisión Técnica')).toBe(6);
    expect(vencReglaDefault('Camioneta', 'Revisión Técnica')).toBe(12);
  });
  it('Decreto 80: solo aplica a Bus (48 meses)', () => {
    expect(vencReglaDefault('Bus', 'Decreto 80')).toBe(48);
    expect(vencReglaDefault('Camioneta', 'Decreto 80')).toBeNull();
  });
  it('tipo de vencimiento desconocido -> sin regla', () => {
    expect(vencReglaDefault('CAEX', 'Vencimiento Inventado')).toBeNull();
  });
});

describe('vencCalcProximo — próxima fecha de vencimiento', () => {
  it('suma la periodicidad en meses a la última fecha', () => {
    expect(vencCalcProximo('2026-01-15', 6)).toBe('2026-07-15');
  });
  it('cruza el fin de año correctamente', () => {
    expect(vencCalcProximo('2026-10-01', 6)).toBe('2027-04-01');
  });
  it('sin fecha o sin periodicidad -> null', () => {
    expect(vencCalcProximo(null, 6)).toBeNull();
    expect(vencCalcProximo('2026-01-15', null)).toBeNull();
    expect(vencCalcProximo('2026-01-15', 0)).toBeNull(); // 0 es falsy en el chequeo del código
  });
  it('fecha inválida -> null, no revienta', () => {
    expect(vencCalcProximo('fecha-invalida', 6)).toBeNull();
  });
});

describe('vencEstado — clasifica el estado de un vencimiento respecto a hoy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('sin fecha próxima -> "Sin datos"', () => {
    expect(vencEstado(null).label).toBe('Sin datos');
    expect(vencEstado(null).dias).toBeNull();
  });
  it('fecha pasada -> VENCIDO, con los días de atraso', () => {
    const r = vencEstado('2026-07-01');
    expect(r.label).toContain('VENCIDO');
    expect(r.dias).toBeLessThan(0);
  });
  it('dentro de 30 días -> alerta amarilla', () => {
    const r = vencEstado('2026-08-01');
    expect(r.label).toContain('Vence en');
    expect(r.dias).toBeLessThanOrEqual(30);
  });
  it('más de 30 días -> OK', () => {
    const r = vencEstado('2026-12-01');
    expect(r.label).toContain('OK');
  });

  it('sin fecha pero SÍ aplica una regla -> "Sin registrar (requerido)", cuenta como alerta', () => {
    const r = vencEstado(null, true);
    expect(r.label).toContain('Sin registrar');
    expect(r.dias).toBeNull();
    expect(r.requiereAtencion).toBe(true);
  });
  it('sin fecha y sin regla aplicable -> "Sin datos", NO es alerta', () => {
    const r = vencEstado(null, false);
    expect(r.label).toBe('Sin datos');
    expect(r.requiereAtencion).toBe(false);
  });
  it('vencido y por vencer también marcan requiereAtencion; OK no', () => {
    expect(vencEstado('2026-07-01').requiereAtencion).toBe(true);
    expect(vencEstado('2026-08-01').requiereAtencion).toBe(true);
    expect(vencEstado('2026-12-01').requiereAtencion).toBe(false);
  });
});
