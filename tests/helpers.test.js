const { fd, fn, escapeHtml } = require('../logic.js');

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
