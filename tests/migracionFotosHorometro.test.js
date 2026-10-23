// Migración de la foto del horómetro (2026-10-24): bucket privado, subir solo usuarios activos, ver solo administradores, columna 'foto'.
import { describe, it, expect } from 'vitest';
const fs = require('fs');
const path = require('path');
const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261024120000_fotos_horometro.sql'), 'utf8').replace(/^--.*$/gm, '');

describe('migración fotos-horometro', () => {
  it('el bucket es privado, solo JPEG y con tope de 2 MB', () => {
    expect(sql).toMatch(/'fotos-horometro',\s*'fotos-horometro',\s*false,\s*2097152,\s*array\['image\/jpeg'\]/);
  });
  it('subir exige un usuario activo y ver exige un administrador activo, ambos acotados al bucket', () => {
    expect(sql).toMatch(/for insert[\s\S]*?with check \(bucket_id = 'fotos-horometro' and privado\.es_usuario_activo\(\)\)/);
    expect(sql).toMatch(/for select[\s\S]*?using \(bucket_id = 'fotos-horometro' and privado\.es_admin_activo\(\)\)/);
  });
  it('no abre ninguna política de lectura, borrado ni actualización a anon ni al público', () => {
    expect(sql).not.toMatch(/to (anon|public)/i);
    expect(sql).not.toMatch(/for (update|delete|all)/i);
  });
  it('agrega la columna foto sin pisar nada', () => {
    expect(sql).toMatch(/alter table public\.historial_horometros add column if not exists foto text/);
    expect(sql).not.toMatch(/drop |truncate|delete from/i);
  });
  it('la app guarda la columna foto al sincronizar historial_horometros', () => {
    const store = fs.readFileSync(path.join(__dirname, '../modules/store.js'), 'utf8');
    expect(store).toMatch(/hist:\{tabla:'historial_horometros'[^}]*cols:\[[^\]]*'foto'[^\]]*\]/);
  });
});
