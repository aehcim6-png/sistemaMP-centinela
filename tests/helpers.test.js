const { fd, fn, escapeHtml, fechaEsPlausible, fechaEsAnterior, duracionHM } = require('../logic.js');

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
