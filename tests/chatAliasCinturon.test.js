// Importador del chat de WhatsApp (23-nov-2026): tabla de alias de equipos y cambios de cinturón / correas / entre dientes.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { chatWhatsAppSigla, chatWhatsAppAnalizar } from '../logic.js';

const SIGLAS = ['CN-9503', 'CN-10155', 'CF-9511', 'CN-9501', 'MN-6112'];
const chat = (...bloques) => bloques.join('\n');
const rep = (f, equipo, motivo, horom) => `${f} - Supervisor: Equipo: ${equipo}\nEstatus: operativo\nMotivo: ${motivo}\nHorometro: ${horom}\nLugar: taller`;

describe('chatWhatsAppSigla con la tabla de alias', () => {
  it('sin alias «CF 511» no se reconoce; con alias va a CF-9511', () => {
    expect(chatWhatsAppSigla('CF 511', SIGLAS)).toBeNull();
    expect(chatWhatsAppSigla('CF 511', SIGLAS, [{ alias: 'CF-511', sigla: 'CF-9511' }])).toBe('CF-9511');
  });
  it('el alias se compara sin espacios, guiones ni mayúsculas', () => {
    const al = [{ alias: 'cf-511', sigla: 'CF-9511' }];
    ['CF 511', 'CF-511', 'cf511', 'CF.511'].forEach((n) => expect(chatWhatsAppSigla(n, SIGLAS, al)).toBe('CF-9511'));
  });
  it('un alias hacia una sigla que ya no existe se ignora', () => {
    expect(chatWhatsAppSigla('CF 511', SIGLAS, [{ alias: 'CF-511', sigla: 'CF-0000' }])).toBeNull();
  });
  it('las reglas de siempre siguen funcionando (CAEX 85 → CN-9503)', () => {
    expect(chatWhatsAppSigla('CAEX 85', SIGLAS)).toBe('CN-9503');
  });
});

describe('cambios de componente del chat', () => {
  const txt = chat(
    rep('06-08-26 22:33', 'CAEX 85', 'nivelación suspensiones, instalación de cinturón de seguridad', '22.542'),
    rep('14-04-26 14:02', 'CE-155', 'instalación de semáforo indicador de uso de cinturon', '1.811'),
    rep('15-04-26 14:02', 'CF 511', 'cambio de entre dientes y engrase', '14.108'),
    rep('16-04-26 14:02', 'CE-86', 'cambio de correa alternador y relleno de fluidos', '20133'),
    rep('17-04-26 14:02', 'MN-12', 'Cambio de base cinturón seguridad', '8000')
  );
  const a = chatWhatsAppAnalizar(txt, { siglas: SIGLAS, desde: '', alias: [{ alias: 'CF-511', sigla: 'CF-9511' }] });
  const c = a.cambios.map((x) => x.sigla + ' ' + x.comp);
  it('reconoce el cambio del cinturón pero no el semáforo del cinturón', () => {
    expect(c).toContain('CN-9503 Cinturón de Seguridad');
    expect(c).toContain('MN-6112 Cinturón de Seguridad');
    expect(c.filter((x) => x.startsWith('CN-10155'))).toEqual([]);
  });
  it('reconoce el cambio de correas y los entre dientes como Elemento de Desgaste', () => {
    expect(c).toContain('CN-9501 Correas/Poleas');
    expect(c).toContain('CF-9511 Elemento de Desgaste');
  });
  it('con el alias el equipo queda resuelto; sin él se informa como sin asignar', () => {
    expect(a.sinResolver).toEqual([]);
    const b = chatWhatsAppAnalizar(txt, { siglas: SIGLAS, desde: '' });
    expect(b.sinResolver.map((x) => x.nombre)).toEqual(['CF 511']);
  });
});

describe('tabla equipos_alias', () => {
  it('la migración da permisos y activa RLS', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261123140000_crear_equipos_alias.sql', import.meta.url), 'utf8');
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/grant select, insert, update, delete on table public\.equipos_alias to authenticated/);
    expect(sql).toMatch(/grant select, insert, update, delete on table public\.equipos_alias to service_role/);
  });
});
