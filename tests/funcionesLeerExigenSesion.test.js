// Todas las funciones que leen fotos con IA (leer-*) gastan la cuota de Gemini: tienen que exigir una sesión iniciada (no basta la llave pública anon).
import { describe, it, expect } from 'vitest';
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '../supabase/functions');
const funciones = fs.readdirSync(base).filter((d) => d.startsWith('leer-'));

describe('funciones leer-*: exigen sesión iniciada', () => {
  it('hay funciones de lectura de fotos que revisar', () => {
    expect(funciones.length).toBeGreaterThanOrEqual(5);
  });
  funciones.forEach((f) => {
    it(f + ' importa la revisión compartida y responde 401 antes de llamar a Gemini', () => {
      const src = fs.readFileSync(path.join(base, f, 'index.ts'), 'utf8');
      expect(src).toMatch(/import \{[^}]*esUsuarioAutenticado[^}]*\} from "\.\.\/_shared\/sesionAutenticada\.ts"/);
      const iAuth = src.indexOf('esUsuarioAutenticado(req.headers.get("authorization"))');
      const iGemini = src.indexOf('generativelanguage.googleapis.com');
      expect(iAuth).toBeGreaterThan(-1);
      expect(iGemini).toBeGreaterThan(iAuth);
      expect(src).toMatch(/MENSAJE_SIN_SESION\s*\}\s*,\s*401/);
    });
  });
});
