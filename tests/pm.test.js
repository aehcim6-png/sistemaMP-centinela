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

describe('C.tipoPM — con frecPM propio del equipo (bug real: camionetas por km siempre daban PM4)', () => {
  it('un vehículo por km (frecPM=10000) reparte PM1-4 igual que uno por horas, a su propia escala', () => {
    expect(C.tipoPM(10000, 10000)).toBe('PM1'); // su primer servicio, no un PM4
    expect(C.tipoPM(20000, 10000)).toBe('PM2');
    expect(C.tipoPM(40000, 10000)).toBe('PM3');
    expect(C.tipoPM(80000, 10000)).toBe('PM4');
  });
  it('sin segundo argumento, usa 250 por defecto (compatibilidad con el comportamiento de siempre)', () => {
    expect(C.tipoPM(2000)).toBe('PM4');
    expect(C.tipoPM(500)).toBe('PM2');
  });
});

describe('C.mtbfReal — MTBF real entre fallas sucesivas (bug real: horomActual/fallas.length)', () => {
  it('menos de 2 fallas con horómetro válido -> null, no se inventa un número', () => {
    expect(C.mtbfReal([])).toBeNull();
    expect(C.mtbfReal([5000])).toBeNull();
    expect(C.mtbfReal([0, 0])).toBeNull(); // 0 no cuenta como horómetro válido
  });
  it('2 fallas -> un solo intervalo entre ambas', () => {
    expect(C.mtbfReal([1000, 1500])).toBe(500);
  });
  it('varias fallas -> promedio de los intervalos sucesivos (rango total / n-1), sin importar el orden de entrada', () => {
    expect(C.mtbfReal([1000, 2000, 3000, 4000])).toBe(1000);
    expect(C.mtbfReal([4000, 1000, 3000, 2000])).toBe(1000); // se ordena internamente
  });
  it('el bug real: el mismo equipo con las mismas fallas ya no cambia de MTBF solo porque avanza el horómetro sin volver a fallar', () => {
    // Antes: horomActual/fallas.length crecía con el tiempo aunque no hubiera fallas nuevas.
    // Ahora: mtbfReal solo depende de los horómetros DE LAS FALLAS ya ocurridas.
    expect(C.mtbfReal([1000, 2000])).toBe(1000);
    expect(C.mtbfReal([1000, 2000])).toBe(1000); // sigue igual, no depende de horomActual
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

describe('C.alertaPM4 — con frecPM propio del equipo (bug real: umbral fijo de 2000h en la pestaña Alertas PM4)', () => {
  it('un vehículo por km (frecPM=10000) usa sus propias bandas 1x/2x/4x, no 250/500/1000h fijos', () => {
    expect(C.alertaPM4(5000, 10000, 'km').t).toContain('URGENTE');
    expect(C.alertaPM4(15000, 10000, 'km').t).toContain('PRÓXIMA');
    expect(C.alertaPM4(30000, 10000, 'km').t).toBe('PLANIFICAR');
    expect(C.alertaPM4(50000, 10000, 'km').t).toContain('OK');
  });
  it('sin segundo/tercer argumento, se comporta igual que siempre (250h de flota por horas)', () => {
    expect(C.alertaPM4(249).t).toContain('URGENTE (<250h)');
    expect(C.alertaPM4(999).t).toBe('PLANIFICAR');
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
    // 500 es 1x el frecPM propio del equipo (500) -> es su PM1, no un PM2 fijo.
    // (antes del fix de tipoPM por frecPM, cualquier equipo en 500h daba 'PM2' sin
    // importar su propio frecPM — el mismo bug que afectaba a las camionetas por km)
    expect(e.tipoPM).toBe('PM1');
  });
  it('un equipo por kilómetros (frecPM=10000) reparte PM1-4 en su propia escala, no siempre PM4', () => {
    const e = { horomActual: 2500, frecPM: 10000, hrsDia: 12 };
    C.recalc(e);
    expect(e.horomProxPM).toBe(10000);
    expect(e.tipoPM).toBe('PM1'); // su primer servicio — antes del fix, esto daba 'PM4' siempre
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
  it('con ritmo real usa ese ritmo (no el nominal) para los días hasta el PM', () => {
    // Quedan 240h. Nominal 16 h/día -> 15 días. Ritmo real 8 h/día -> 30 días.
    const e = { horomActual: 260, frecPM: 500, hrsDia: 16 };
    C.recalc(e, 8);
    expect(e.hrsRestantes).toBe(240);
    expect(e.diasParaPM).toBe(30);        // usa el ritmo real (8), no el nominal (16)
    expect(e.estado).toContain('PRÓXIMA'); // 30 días -> PRÓXIMA, no URGENTE
  });
  it('sin ritmo real cae al hrsDia nominal (compatibilidad hacia atrás)', () => {
    const e = { horomActual: 260, frecPM: 500, hrsDia: 16 };
    C.recalc(e);                 // sin segundo argumento
    expect(e.diasParaPM).toBe(15); // 240/16
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
