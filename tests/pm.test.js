const { C, validarMotivoPmPendiente, mtbfFlotaReal, confiabilidadReal, regEsATiempo } = require('../logic.js');

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

describe('mtbfFlotaReal — MTBF de flota (bug real: Reporte Ejecutivo usaba horómetro-en-vivo ÷ fallas-de-toda-la-vida)', () => {
  it('promedia el MTBF real de cada equipo con al menos 2 fallas', () => {
    const eq = [{ sigla: 'A' }, { sigla: 'B' }];
    const ot = [
      { sigla: 'A', tipo: 'Correctivo', horom: 1000 },
      { sigla: 'A', tipo: 'Correctivo', horom: 2000 }, // A: MTBF real = 1000
      { sigla: 'B', tipo: 'Falla Operacional', horom: 500 },
      { sigla: 'B', tipo: 'Falla Operacional', horom: 800 }, // B: MTBF real = 300
    ];
    expect(mtbfFlotaReal(eq, ot)).toBe(650); // promedio de (1000, 300)
  });

  it('un equipo con menos de 2 fallas no aporta (no inventa un intervalo)', () => {
    const eq = [{ sigla: 'A' }, { sigla: 'SIN-FALLAS' }];
    const ot = [
      { sigla: 'A', tipo: 'Correctivo', horom: 1000 },
      { sigla: 'A', tipo: 'Correctivo', horom: 2000 },
    ];
    expect(mtbfFlotaReal(eq, ot)).toBe(1000); // solo A aporta
  });

  it('ningún equipo con datos suficientes -> null, no se inventa un número', () => {
    const eq = [{ sigla: 'A' }, { sigla: 'B' }];
    const ot = [{ sigla: 'A', tipo: 'Correctivo', horom: 1000 }]; // solo 1 falla
    expect(mtbfFlotaReal(eq, ot)).toBeNull();
    expect(mtbfFlotaReal([], [])).toBeNull();
  });

  it('ignora correctivos de tipo distinto a Correctivo/Falla Operacional (ej. Fuera de Servicio administrativo)', () => {
    const eq = [{ sigla: 'A' }];
    const ot = [
      { sigla: 'A', tipo: 'Correctivo', horom: 1000 },
      { sigla: 'A', tipo: 'Correctivo', horom: 2000 },
      { sigla: 'A', tipo: 'Otro', horom: 9999 }, // no cuenta
    ];
    expect(mtbfFlotaReal(eq, ot)).toBe(1000);
  });

  it('equipos por km (unidad="km") se excluyen, igual que en el resto de los cálculos de horas-flota', () => {
    const eq = [{ sigla: 'A' }, { sigla: 'CAMIONETA-KM', unidad: 'km' }];
    const ot = [
      { sigla: 'A', tipo: 'Correctivo', horom: 1000 },
      { sigla: 'A', tipo: 'Correctivo', horom: 2000 },
      { sigla: 'CAMIONETA-KM', tipo: 'Correctivo', horom: 100 },
      { sigla: 'CAMIONETA-KM', tipo: 'Correctivo', horom: 50000 }, // intervalo enorme, no debe distorsionar el promedio
    ];
    expect(mtbfFlotaReal(eq, ot)).toBe(1000);
  });

  it('el bug real que arregla: NO depende del horómetro en vivo de los equipos ni cambia solo porque pasa el tiempo', () => {
    // Antes (Reporte Ejecutivo): mtbf = suma de horomActual de TODOS los equipos / fallas
    // totales — ese número sube cada día aunque no haya vuelto a fallar nada. Acá,
    // agregar más "horómetro en vivo" (que ni siquiera es un input de esta función) no
    // puede cambiar el resultado — la función ni siquiera recibe ese dato.
    const eq = [{ sigla: 'A' }];
    const ot = [
      { sigla: 'A', tipo: 'Correctivo', horom: 1000 },
      { sigla: 'A', tipo: 'Correctivo', horom: 2000 },
    ];
    const r1 = mtbfFlotaReal(eq, ot);
    const r2 = mtbfFlotaReal(eq, ot); // "otro día", mismos datos de fallas
    expect(r1).toBe(r2);
    expect(r1).toBe(1000);
  });
});

describe('confiabilidadReal — R(t)=e^(-t/MTBF), probabilidad de no fallar en el período (auditoría 2026-08: "Confiabilidad" del Dashboard era solo % de equipos sin correctivo, no una probabilidad real)', () => {
  it('sin MTBF (null o <=0) -> null, no se inventa un número', () => {
    expect(confiabilidadReal(null, 500)).toBeNull();
    expect(confiabilidadReal(0, 500)).toBeNull();
    expect(confiabilidadReal(-100, 500)).toBeNull();
  });
  it('sin horas de período (null) -> null', () => {
    expect(confiabilidadReal(1000, null)).toBeNull();
  });
  it('t=0 (sin horas operadas todavía) -> 100% (R(0)=1 por definición)', () => {
    expect(confiabilidadReal(1000, 0)).toBe(100);
  });
  it('t=MTBF -> R≈36.8% (e^-1), el punto de referencia clásico de la curva exponencial', () => {
    expect(confiabilidadReal(1000, 1000)).toBe(36.8);
  });
  it('período mucho menor que el MTBF -> confiabilidad alta', () => {
    // t=100, MTBF=2000 -> e^(-0.05) ≈ 0.9512
    expect(confiabilidadReal(2000, 100)).toBe(95.1);
  });
  it('período mucho mayor que el MTBF -> confiabilidad baja, tendiendo a 0 (nunca negativa)', () => {
    // t=5000, MTBF=500 -> e^-10 ≈ 0.0000454
    expect(confiabilidadReal(500, 5000)).toBe(0);
  });
});

describe('regEsATiempo — fuente única de "¿este PM fue a tiempo?" (bug real, auditoría 2026-08: r.estado==="A tiempo" nunca coincidía con el dato real guardado)', () => {
  it('desvioDias<=0 (a tiempo o anticipado) -> true', () => {
    expect(regEsATiempo({ desvioDias: 0 })).toBe(true);
    expect(regEsATiempo({ desvioDias: -3 })).toBe(true);
  });
  it('desvioDias>0 (atrasado) -> false', () => {
    expect(regEsATiempo({ desvioDias: 5 })).toBe(false);
  });
  it('sin desvioDias numérico (ej. importado por CSV sin fecha esperada) -> null, no se inventa un resultado', () => {
    expect(regEsATiempo({})).toBeNull();
    expect(regEsATiempo({ estado: 'A tiempo' })).toBeNull(); // el string viejo ya no se usa ni se confía en él
    expect(regEsATiempo({ desvioDias: null })).toBeNull();
    expect(regEsATiempo({ desvioDias: NaN })).toBeNull();
    expect(regEsATiempo(null)).toBeNull();
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

describe('C.proxPM — la grilla oficial NUNCA se corre; solo salta un hito ya cubierto por un PM anticipado', () => {
  it('bug real: un PM hecho un poco DESPUÉS de su hito no debe correr el calendario (270 en vez de 250 -> el siguiente sigue siendo 500, no 520)', () => {
    // Antes de este fix, anclar al horómetro exacto del último PM real corría TODO
    // el calendario para siempre (270+250=520). El hito 250 se cubrió (con algo de
    // atraso), y el próximo hito de la grilla oficial sigue siendo 500 — la grilla
    // pura ya da esa respuesta sola, sin necesitar ningún ajuste.
    expect(C.proxPM(270, 250, 270, 'PM1')).toBe(500);
  });
  it('bug real: un PM4 anticipado (BD-10139, hecho en 1977 antes de llegar a su hito 2000) no debe pedir otro PM casi de inmediato', () => {
    // La grilla pura (Math.ceil(1977/250)*250=2000) decía "vencido en 23h" — sin
    // sentido, porque ese PM4 ya cubrió el hito 2000 (2000 es 8x250, su propio
    // ciclo). El próximo hito de la grilla después de 2000 es 2250.
    expect(C.proxPM(1977, 250, 1977, 'PM4')).toBe(2250);
  });
  it('con huecos reales en el registro (varios ciclos sin anotar desde el último PM), la grilla pura ya es la respuesta correcta, sin ajuste', () => {
    // MN-5926 real: último PM2 en 8509 (cubre hasta el múltiplo de 500 más cercano,
    // 8500), horómetro actual 8978 — muy por delante de ese hito. La grilla pura
    // (9000) ya está más adelante que "hito+250" (8750), así que se usa la grilla.
    expect(C.proxPM(8978, 250, 8509, 'PM2')).toBe(9000);
    // GE-10019 real: mismo caso, hueco grande desde el último PM2.
    expect(C.proxPM(12747, 250, 9529, 'PM2')).toBe(12750);
  });
  it('un tipo de PM desconocido o mal cargado (typo de importación) cae al ciclo base 1x — nunca empuja el próximo PM más de lo debido', () => {
    expect(C.proxPM(9212, 250, 9055, 'PM6')).toBe(9250);
  });
  it('nunca da un resultado por debajo del horómetro actual', () => {
    const p = C.proxPM(5000, 250, 100, 'PM1');
    expect(p).toBeGreaterThanOrEqual(5000);
  });
  it('sin datos del último PM (undefined/null), se comporta igual que siempre — grilla modular pura', () => {
    expect(C.proxPM(1977, 250)).toBe(2000);
    expect(C.proxPM(1977, 250, null)).toBe(2000);
  });
  it('nunca acredita un hito que el equipo TODAVÍA no alcanzó (próximo PM a más de un ciclo)', () => {
    // Casos reales de la flota por kilómetros: el hito propio del último PM caía
    // por DELANTE del odómetro actual y Math.round() lo daba por cubierto, dejando
    // el próximo PM a más de un ciclo completo — físicamente imposible.
    // BS-5752: bus en 415.000 km, PM2 en 410.000, ciclo 10.000 -> pedía 430.000.
    expect(C.proxPM(415000, 10000, 410000, 'PM2')).toBe(420000);
    // CA-5979: camioneta en 115.300 km, PM2 en 114.798 -> pedía 130.000.
    expect(C.proxPM(115300, 10000, 114798, 'PM2')).toBe(120000);
    // CA-9927: camioneta en 77.304 km, PM2 en 77.304 -> pedía 90.000.
    expect(C.proxPM(77304, 10000, 77304, 'PM2')).toBe(80000);
  });
  it('el remanente hasta el próximo PM nunca supera el ciclo del equipo', () => {
    const flota = [
      { h: 415000, f: 10000, ult: 410000, tipo: 'PM2' },
      { h: 115300, f: 10000, ult: 114798, tipo: 'PM2' },
      { h: 77304, f: 10000, ult: 77304, tipo: 'PM2' },
      { h: 86112, f: 10000, ult: 78112, tipo: 'PM2' },
    ];
    flota.forEach(({ h, f, ult, tipo }) => {
      expect(C.proxPM(h, f, ult, tipo) - h).toBeLessThanOrEqual(f);
    });
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
  it('con horomUltimoPM/tipoUltimoPM detecta un PM4 anticipado y no pide otro PM casi de inmediato (caso real BD-10139)', () => {
    const e = { horomActual: 1977, frecPM: 250, hrsDia: 12 };
    C.recalc(e, 12, 1977, 'PM4'); // PM4 recién hecho HOY en 1977, antes de su hito 2000
    expect(e.horomProxPM).toBe(2250);
    expect(e.hrsRestantes).toBe(273);
    // 273h a 12h/día ~ 23 días -> ya no "URGENTE" a los pocos días
    expect(e.estado).not.toContain('URGENTE');
  });
  it('un PM hecho un poco después de su hito no corre el calendario oficial (bug real: 270 corría todo a 520 en vez de dejarlo en 500)', () => {
    const e = { horomActual: 270, frecPM: 250, hrsDia: 12 };
    C.recalc(e, 12, 270, 'PM1');
    expect(e.horomProxPM).toBe(500);
  });

  // Caso real CF-8769: último PM en 15264 (cubre el hito 15250), ningún PM
  // registrado desde entonces, horómetro actual 15518 (ya pasado el hito 15500).
  // proxPM (mismo "hueco real" que MN-5926/GE-10019) salta a la grilla pura
  // (15750) sin avisar — el sistema no puede distinguir "se saltó de verdad" de
  // "se hizo pero no se anotó" solo con los números. pmPendienteManual es el
  // escape manual para cuando el usuario SÍ lo sabe.
  it('pmPendienteManual gana sobre el cálculo automático cuando es más temprano (caso real CF-8769)', () => {
    const e = { horomActual: 15518, frecPM: 250, hrsDia: 16, pmPendienteManual: 15500 };
    C.recalc(e, 16, 15264, 'PM1');
    expect(e.horomProxPM).toBe(15500);
    expect(e.hrsRestantes).toBe(-18); // ya vencido, no "232h para el próximo"
    expect(e.estado).toContain('VENCIDA');
  });
  it('pmPendienteManual no tiene efecto si es igual o posterior a lo que ya calculó proxPM (no hace nada raro)', () => {
    const e = { horomActual: 480, frecPM: 500, hrsDia: 20, pmPendienteManual: 600 };
    C.recalc(e, 20, null, null);
    expect(e.horomProxPM).toBe(500); // sigue siendo el cálculo automático normal
  });
  it('pmPendienteManual vacío/0/null no cambia nada (compatibilidad con equipos sin este dato)', () => {
    const e1 = { horomActual: 480, frecPM: 500, hrsDia: 20, pmPendienteManual: null };
    const e2 = { horomActual: 480, frecPM: 500, hrsDia: 20, pmPendienteManual: 0 };
    C.recalc(e1, 20); C.recalc(e2, 20);
    expect(e1.horomProxPM).toBe(500);
    expect(e2.horomProxPM).toBe(500);
  });
});

describe('validarMotivoPmPendiente — exige justificación al marcar un hito pendiente', () => {
  it('exige motivo al marcar un hito nuevo (antes no había ninguno)', () => {
    const r = validarMotivoPmPendiente(null, 15500, '');
    expect(r.valido).toBe(false);
    expect(r.motivoError).toMatch(/motivo/i);
  });
  it('acepta si el motivo viene con texto real (caso real CF-8769)', () => {
    const r = validarMotivoPmPendiente(null, 15500, 'PM4 lo hizo el proveedor externo en terreno, no se alcanzó a registrar acá');
    expect(r.valido).toBe(true);
  });
  it('rechaza un motivo que es solo espacios en blanco', () => {
    const r = validarMotivoPmPendiente(null, 15500, '   ');
    expect(r.valido).toBe(false);
  });
  it('exige motivo también cuando se CAMBIA un hito ya marcado a otro distinto', () => {
    const r = validarMotivoPmPendiente(15500, 15750, '');
    expect(r.valido).toBe(false);
  });
  it('no exige motivo si el valor no cambió (guardar la ficha sin tocar este campo)', () => {
    const r = validarMotivoPmPendiente(15500, 15500, '');
    expect(r.valido).toBe(true);
  });
  it('no exige motivo al LIMPIAR el hito (pasar de un valor a null/0)', () => {
    expect(validarMotivoPmPendiente(15500, null, '').valido).toBe(true);
    expect(validarMotivoPmPendiente(15500, 0, '').valido).toBe(true);
  });
  it('no exige motivo cuando nunca hubo ni hay valor (caso normal, sin este dato)', () => {
    expect(validarMotivoPmPendiente(null, null, '').valido).toBe(true);
    expect(validarMotivoPmPendiente(0, 0, '').valido).toBe(true);
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

  it('ignora una lectura con salto implausible (>4x lo nominal) y sigue con la última válida', () => {
    const histConError = [
      { sigla: 'TI-5144', fecha: '2026-01-26', horom: 17833 },
      { sigla: 'TI-5144', fecha: '2026-01-27', horom: 178845 }, // error real: 161.012 en 1 día
      { sigla: 'TI-5144', fecha: '2026-02-05', horom: 17950 },
    ];
    // La lectura del 27 se ignora por implausible; la del 05-feb (17950) es un
    // avance normal respecto de la última VÁLIDA (17833 del 26-ene), así que sigue.
    expect(C.horomHistorico(histConError, 'TI-5144', '2026-01-31')).toBe(17833);
    expect(C.horomHistorico(histConError, 'TI-5144', '2026-02-05')).toBe(17950);
  });

  it('ignora una lectura que retrocede respecto de la última válida', () => {
    const histRetroceso = [
      { sigla: 'BD-9509', fecha: '2026-01-01', horom: 5000 },
      { sigla: 'BD-9509', fecha: '2026-01-10', horom: 4800 }, // retrocede, se ignora
      { sigla: 'BD-9509', fecha: '2026-01-20', horom: 5100 },
    ];
    expect(C.horomHistorico(histRetroceso, 'BD-9509', '2026-01-15')).toBe(5000);
    expect(C.horomHistorico(histRetroceso, 'BD-9509', '2026-01-20')).toBe(5100);
  });
});

describe('C.lecturasValidas — descarta saltos implausibles/retrocesos sin borrar el dato', () => {
  it('devuelve todas las lecturas cuando los avances son plausibles', () => {
    const hist = [
      { sigla: 'AA-1', fecha: '2026-01-01', horom: 100 },
      { sigla: 'AA-1', fecha: '2026-01-02', horom: 110 },
      { sigla: 'AA-1', fecha: '2026-01-03', horom: 120 },
    ];
    expect(C.lecturasValidas(hist, 'AA-1').length).toBe(3);
  });

  it('descarta solo la lectura sospechosa, no las que vienen después y son razonables', () => {
    const hist = [
      { sigla: 'AA-1', fecha: '2026-01-01', horom: 100 },
      { sigla: 'AA-1', fecha: '2026-01-02', horom: 999999 }, // implausible
      { sigla: 'AA-1', fecha: '2026-01-03', horom: 130 }, // razonable vs. la última VÁLIDA (100)
    ];
    const validas = C.lecturasValidas(hist, 'AA-1');
    expect(validas.map(v => v.horom)).toEqual([100, 130]);
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
