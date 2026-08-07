import { describe, it, expect } from 'vitest';
import { csvCeldaSegura } from '../logic.js';

// CSV/Formula Injection (CWE-1236): exportCSV/exportTabla/genExcelSheet
// insertaban cualquier campo de texto libre tal cual — un valor que empieza
// con = + - @ se interpreta como fórmula al abrir el CSV/Excel exportado.
describe('csvCeldaSegura', () => {
  it('antepone apóstrofo a valores que empiezan con =, +, -, @', () => {
    expect(csvCeldaSegura('=CMD("/C calc")!A1')).toBe("'=CMD(\"/C calc\")!A1");
    expect(csvCeldaSegura('+2+3')).toBe("'+2+3");
    expect(csvCeldaSegura('-15% bajo meta')).toBe("'-15% bajo meta");
    expect(csvCeldaSegura('@turno noche')).toBe("'@turno noche");
  });
  it('antepone apóstrofo a tab/retorno de carro (variantes de la misma inyección)', () => {
    expect(csvCeldaSegura('\t=1+1')).toBe("'\t=1+1");
  });
  it('texto normal (sin prefijo riesgoso) queda intacto', () => {
    expect(csvCeldaSegura('Cambio de filtro')).toBe('Cambio de filtro');
    expect(csvCeldaSegura('Juan Pérez')).toBe('Juan Pérez');
    expect(csvCeldaSegura('')).toBe('');
  });
  it('un guion en medio del texto (no al inicio) no dispara el prefijo', () => {
    expect(csvCeldaSegura('cambio-filtro-aceite')).toBe('cambio-filtro-aceite');
  });
  it('null/undefined no revientan, se tratan como texto vacío', () => {
    expect(csvCeldaSegura(null)).toBe('');
    expect(csvCeldaSegura(undefined)).toBe('');
  });
  it('números pasados como string con signo negativo también se protegen (costo del diseño: se exportan como texto, no como número)', () => {
    expect(csvCeldaSegura('-500')).toBe("'-500");
  });
});
