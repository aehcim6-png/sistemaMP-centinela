// Revisión estática de la migración de «accesos del servidor» (20261022120000): las propiedades de seguridad que no deben perderse en un cambio futuro.
// El comportamiento (reglas, correo, solo-agregar, permisos) se probó contra un Postgres real con las tablas de Supabase simuladas; esto solo vigila que el archivo no pierda esas protecciones.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261022120000_crear_accesos_servidor.sql'), 'utf8');
const codigo = sql.replace(/--[^\n]*/g, '');

describe('migración accesos_servidor', () => {
  it('solo un admin con MFA lee la tabla y nadie escribe por la API', () => {
    expect(codigo).toMatch(/alter table public\.accesos_servidor enable row level security/i);
    expect(codigo).toMatch(/for select to authenticated using \(privado\.es_admin_activo\(\)\)/i);
    expect(codigo).not.toMatch(/for (insert|update|delete)\s+to/i);
    expect(codigo).not.toMatch(/grant[^;]*(insert|update|delete)[^;]*to authenticated/i);
    expect(codigo).not.toMatch(/to anon/i);
  });
  it('es de solo agregar: trigger que bloquea borrar, vaciar y editar las columnas de hecho', () => {
    expect(codigo).toMatch(/before update or delete on public\.accesos_servidor/i);
    expect(codigo).toMatch(/before truncate on public\.accesos_servidor/i);
    ['sesion_id', 'usuario_id', 'ip', 'navegador', 'sesion_creada', 'detectado_en'].forEach((c) => expect(codigo).toContain(`old.${c}`));
  });
  it('las funciones que leen auth son security definer con search_path vacío y no las ejecuta la API', () => {
    ['capturar_accesos', 'avisar_accesos_sospechosos'].forEach((f) => {
      const m = new RegExp(`function privado\\.${f}\\(\\)[\\s\\S]*?\\$\\$;`, 'i').exec(codigo);
      expect(m, f).toBeTruthy();
      expect(m[0]).toMatch(/security definer set search_path = ''/i);
      expect(codigo).toMatch(new RegExp(`revoke all on function privado\\.${f}\\(\\) from public, anon, authenticated`, 'i'));
    });
  });
  it('el correo escapa todo lo que controla quien inicia sesión y no lleva claves escritas', () => {
    ['f.usuario_email', 'f.ip', 'f.navegador'].forEach((c) => expect(codigo).toMatch(new RegExp(`escapar_html\\(\\s*(coalesce\\(\\s*)?${c.replace('.', '\\.')}`)));
    expect(codigo).toMatch(/vault\.decrypted_secrets where name = 'resend_api_key'/);
    expect(codigo).not.toMatch(/re_[A-Za-z0-9]{10,}/);
    expect(codigo).not.toMatch(/Bearer [A-Za-z0-9_-]{20,}/);
  });
  it('programa la captura cada minuto y el aviso cada 5, y deja la foto inicial antes de programar', () => {
    expect(codigo).toMatch(/cron\.schedule\('capturar-accesos', '\* \* \* \* \*'/);
    expect(codigo).toMatch(/cron\.schedule\('avisar-accesos-sospechosos', '\*\/5 \* \* \* \*'/);
    expect(codigo.indexOf('select privado.capturar_accesos();')).toBeLessThan(codigo.indexOf('cron.schedule'));
  });
  it('una IP nueva sola no es roja (los datos móviles la cambian seguido)', () => {
    expect(codigo).toMatch(/elsif v_ip_nueva then[\s\S]*?v_nivel <> 'rojo' then v_nivel := 'ambar'/i);
  });
});
