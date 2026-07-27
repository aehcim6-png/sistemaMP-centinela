const { fd, fn, escapeHtml, fechaEsPlausible, fechaEsAnterior, duracionHM, medianaPositiva, construirLecturaHistorial } = require('../logic.js');

describe('lubVigente — consolidar lubricantes descontinuados en el vigente', () => {
  const { lubVigente, lubEsObsoleto } = require('../logic.js');

  it('los tres aceites de transmisión antiguos caen en MOBILUBE 1 SHC 75W90', () => {
    expect(lubVigente('MOBILUBE HD PLUS 85W-140')).toBe('MOBILUBE 1 SHC 75W90');
    expect(lubVigente('MOBILUBE SAE 80W90')).toBe('MOBILUBE 1 SHC 75W90');
    expect(lubVigente('MOBIL GEAR OIL 75W90')).toBe('MOBILUBE 1 SHC 75W90');
  });
  it('la grasa XHP 222 se reemplaza por XHP 322 MINE', () => {
    expect(lubVigente('MOBILGREASE XHP 222')).toBe('MOBILGREASE XHP 322 MINE');
  });
  it('DTE 10 EXCEL 46 -> MOBILTRANS HD 10W y SUPER 2000 -> DELVAC XHP ESP S', () => {
    expect(lubVigente('MOBIL DTE 10 EXCEL 46')).toBe('MOBILTRANS HD 10W');
    expect(lubVigente('MOBIL SUPER 2000 10W40')).toBe('MOBIL DELVAC XHP ESP S 10W-40');
  });
  it('un producto vigente se devuelve igual — no se toca', () => {
    expect(lubVigente('MOBIL MODERN 15W40 FULL PROT')).toBe('MOBIL MODERN 15W40 FULL PROT');
    expect(lubEsObsoleto('MOBIL MODERN 15W40 FULL PROT')).toBe(false);
  });
  it('tolera minúsculas y espacios de más (vienen así desde las pautas)', () => {
    expect(lubVigente('  mobilube   sae 80w90 ')).toBe('MOBILUBE 1 SHC 75W90');
  });
  it('el destino de un reemplazo no se marca como obsoleto', () => {
    expect(lubEsObsoleto('MOBILUBE HD PLUS 85W-140')).toBe(true);
    expect(lubEsObsoleto('MOBILUBE 1 SHC 75W90')).toBe(false);
  });
  it('vacío o nulo no rompe', () => {
    expect(lubVigente('')).toBe('');
    expect(lubVigente(null)).toBe('');
  });
});

describe('medianaPositiva — duración típica real de un PM', () => {
  it('mediana simple con cantidad impar', () => {
    expect(medianaPositiva([2, 4, 3])).toBe(3);
  });
  it('cantidad par -> promedio de los dos centrales', () => {
    expect(medianaPositiva([1, 2, 3, 10])).toBe(2.5);
  });
  it('ignora ceros, negativos y no-números', () => {
    expect(medianaPositiva([0, -5, NaN, 3])).toBe(3);
  });
  it('robusta a un atípico: un registro de 30h no arrastra el plan como lo haría el promedio', () => {
    expect(medianaPositiva([2, 2.5, 3, 30.8])).toBe(2.75);
  });
  it('sin datos válidos -> null, no se inventa un número', () => {
    expect(medianaPositiva([])).toBeNull();
    expect(medianaPositiva([0])).toBeNull();
    expect(medianaPositiva(null)).toBeNull();
  });
});

describe('fd — formato de fecha para mostrar', () => {
  it('vacío, "None" o 0 -> guión largo', () => {
    expect(fd(null)).toBe('—');
    expect(fd('None')).toBe('—');
    expect(fd(0)).toBe('—');
  });
  it('recorta cualquier fecha a los primeros 10 caracteres (YYYY-MM-DD)', () => {
    expect(fd('2026-07-14T12:00:00Z')).toBe('2026-07-14');
  });
});

describe('fn — formato de número con separador de miles es-CL', () => {
  it('nulo o indefinido -> "0"', () => {
    expect(fn(null)).toBe('0');
    expect(fn(undefined)).toBe('0');
  });
  it('formatea con separador de miles (es-CL usa punto, no coma)', () => {
    expect(fn(1234567)).toBe('1.234.567');
    expect(fn(1000)).toBe('1.000');
  });
});

describe('escapeHtml — el fix de XSS de esta sesión', () => {
  it('escapa los 5 caracteres peligrosos de HTML', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
    expect(escapeHtml('&')).toBe('&amp;');
  });

  it('neutraliza el payload de escape de atributo usado durante las pruebas de hoy', () => {
    const payload = '" onmouseover="alert(1)';
    const escaped = escapeHtml(payload);
    // Ya no puede cerrar el atributo value="..." de un <input>
    expect(escaped).not.toContain('"');
    expect(escaped).toBe('&quot; onmouseover=&quot;alert(1)');
  });

  it('null/undefined no revientan, se tratan como cadena vacía', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('texto normal sin caracteres especiales queda intacto', () => {
    expect(escapeHtml('Cambio filtro aceite motor')).toBe('Cambio filtro aceite motor');
  });
});

describe('fechaEsPlausible — rechaza años corruptos (bug real: registro con fechaEntrada "10000-12-31")', () => {
  it('vacío se considera plausible (se valida "requerido" aparte)', () => {
    expect(fechaEsPlausible('')).toBe(true);
    expect(fechaEsPlausible(null)).toBe(true);
  });
  it('fecha normal dentro de rango -> plausible', () => {
    expect(fechaEsPlausible('2026-07-14')).toBe(true);
    expect(fechaEsPlausible('2000-01-01')).toBe(true);
  });
  it('año de 5 dígitos -> no plausible (el caso real que se coló)', () => {
    expect(fechaEsPlausible('10000-12-31')).toBe(false);
  });
  it('año fuera del rango 2000-2100 -> no plausible', () => {
    expect(fechaEsPlausible('1899-01-01')).toBe(false);
    expect(fechaEsPlausible('2101-01-01')).toBe(false);
  });
  it('formato no-ISO -> no plausible', () => {
    expect(fechaEsPlausible('31-12-2025')).toBe(false);
  });
});

describe('duracionHM — un solo cálculo de duración, ya no copiado 4 veces (calcDurReg/calcDurEdit/saveReg/saveEditReg)', () => {
  it('falta algún dato -> null', () => {
    expect(duracionHM('', '08:00', '2026-07-14', '10:00')).toBeNull();
    expect(duracionHM('2026-07-14', '', '2026-07-14', '10:00')).toBeNull();
    expect(duracionHM('2026-07-14', '08:00', '', '10:00')).toBeNull();
    expect(duracionHM('2026-07-14', '08:00', '2026-07-14', '')).toBeNull();
  });
  it('caso normal: calcula horas/minutos y el texto formateado', () => {
    const d = duracionHM('2026-07-14', '08:00', '2026-07-14', '10:30');
    expect(d.horas).toBe(2.5);
    expect(d.texto).toBe('2h 30min');
    expect(d.ms).toBeGreaterThan(0);
  });
  it('cruza medianoche', () => {
    const d = duracionHM('2026-07-14', '22:00', '2026-07-15', '01:00');
    expect(d.texto).toBe('3h 00min');
  });
  it('salida antes que entrada -> ms negativo (el llamador decide si es error)', () => {
    const d = duracionHM('2026-07-14', '10:00', '2026-07-14', '08:00');
    expect(d.ms).toBeLessThan(0);
  });
});

describe('fechaEsAnterior — compara fechas como fechas, no como texto', () => {
  it('caso normal: fecha anterior real', () => {
    expect(fechaEsAnterior('2025-01-30', '2025-01-31')).toBe(true);
    expect(fechaEsAnterior('2025-01-31', '2025-01-30')).toBe(false);
  });
  it('el bug real: comparar como texto diría que "10000-12-31" es ANTERIOR a "2025-01-31" (falso) — como fecha, es muy posterior', () => {
    expect('10000-12-31' < '2025-01-31').toBe(true); // así fallaba la validación vieja
    expect(fechaEsAnterior('10000-12-31', '2025-01-31')).toBe(false); // fechaEsAnterior lo corrige
  });
});

describe('construirLecturaHistorial — fila de historial_horometros con "horomIni" correcto incluso en carga retroactiva', () => {
  it('usa la lectura previa más reciente CRONOLÓGICAMENTE a la fecha nueva como horomIni', () => {
    const hist = [
      { sigla: 'CF-9511', fecha: '2026-04-13', horomFin: 13995 },
      { sigla: 'CF-9511', fecha: '2026-06-08', horomFin: 14250 },
    ];
    const fila = construirLecturaHistorial(hist, 'CF-9511', '2026-07-23', 14438, 'eq');
    expect(fila).toEqual({ sigla: 'CF-9511', fecha: '2026-07-23', horomIni: 14250, horomFin: 14438, horom: 14438, origen: 'eq' });
  });
  it('bug real (CF-9511): sin esto, el historial quedaba con un hueco de 45 días entre la última lectura y el horómetro en vivo del equipo', () => {
    // Antes de este fix, editar el horómetro directo en Equipos no dejaba rastro en
    // el historial — tasaDiariaReal seguía usando el tramo viejo (04-13 -> 06-08)
    // en vez del más reciente y relevante (06-08 -> hoy).
    const hist = [{ sigla: 'CF-9511', fecha: '2026-06-08', horomFin: 14250 }];
    const fila = construirLecturaHistorial(hist, 'CF-9511', '2026-07-23', 14438, 'eq');
    expect(fila.horomIni).toBe(14250);
    expect(fila.horomFin).toBe(14438);
  });
  it('un registro RETROACTIVO (fecha intercalada en el pasado) busca el dato que de verdad venía antes de esa fecha, no el más reciente del arreglo', () => {
    const hist = [
      { sigla: 'BD-9509', fecha: '2026-01-01', horomFin: 1000 },
      { sigla: 'BD-9509', fecha: '2026-06-01', horomFin: 2000 }, // el más reciente, pero POSTERIOR a la fecha retroactiva
    ];
    const fila = construirLecturaHistorial(hist, 'BD-9509', '2026-03-01', 1500, 'reg');
    expect(fila.horomIni).toBe(1000); // el de 2026-01-01, no el de 2026-06-01
  });
  it('sin ningún dato previo, horomIni es 0', () => {
    const fila = construirLecturaHistorial([], 'CN-9999', '2026-01-01', 500, 'reg');
    expect(fila.horomIni).toBe(0);
  });
});
