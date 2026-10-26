// El plano de fallas (docs/plano-fallas.json) es el mapa que se lee primero ante una falla: si deja de reflejar el repositorio, engaña.
// Esta prueba lo cruza con lo que existe de verdad (funciones, tareas programadas, tablas del respaldo, servicios externos) y comprueba que lo generado coincida con el JSON.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const raiz = path.resolve(__dirname, '..');
const reg = JSON.parse(fs.readFileSync(path.join(raiz, 'docs/plano-fallas.json'), 'utf8'));
const ids = reg.piezas.map(p => p.id);
const leer = rel => fs.readFileSync(path.join(raiz, rel), 'utf8');

describe('plano de fallas: estructura', () => {
  it('cada código es único y tiene el formato PREFIJO-NN', () => {
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(id => expect(id).toMatch(/^[A-Z]{2,3}-\d{2}$/));
  });
  it('toda ficha tiene lo que hace útil al plano: qué es, dónde está, cómo se ve, cómo confirmar y qué hacer', () => {
    reg.piezas.forEach(p => {
      expect(p.que_es, p.id).toBeTruthy();
      expect(p.donde.length, p.id + ' dónde').toBeGreaterThan(0);
      expect(p.sintomas.length, p.id + ' síntomas').toBeGreaterThan(0);
      expect(p.revisar.length, p.id + ' revisar').toBeGreaterThan(0);
      expect(p.accion.length, p.id + ' acción').toBeGreaterThan(0);
      expect(reg.capas.map(c => c[0]), p.id + ' capa').toContain(p.capa);
    });
  });
  it('las dependencias y los códigos de la tabla de síntomas apuntan a fichas que existen', () => {
    reg.piezas.forEach(p => p.depende_de.forEach(d => expect(ids, p.id + ' depende de ' + d).toContain(d)));
    reg.sintomas.forEach(s => s.codigos.forEach(c => expect(ids, s.texto).toContain(c)));
  });
  it('los dos proyectos están descritos con su Supabase, su Vercel y su repositorio', () => {
    ['centinela', 'mp2'].forEach(k => {
      const p = reg.proyectos[k];
      expect(p.ref).toMatch(/^[a-z]{20}$/); expect(p.vercel).toBeTruthy(); expect(p.url).toMatch(/^https:\/\//); expect(p.repo).toMatch(/\//);
    });
  });
  it('solo se usan las marcas de dirección conocidas ({sb}, {url}, {vercel}, {repo}, {ref})', () => {
    const marcas = JSON.stringify(reg).match(/\{[a-z]+\}/g) || [];
    marcas.forEach(m => expect(['{sb}', '{url}', '{vercel}', '{repo}', '{ref}']).toContain(m));
  });
});

describe('plano de fallas: coincide con el repositorio', () => {
  it('toda Edge Function del repositorio tiene su ficha EF-NN y toda ficha EF apunta a una carpeta real', () => {
    const carpetas = fs.readdirSync(path.join(raiz, 'supabase/functions')).filter(d => d !== '_shared' && fs.statSync(path.join(raiz, 'supabase/functions', d)).isDirectory());
    const enPlano = reg.piezas.filter(p => p.id.startsWith('EF-')).map(p => p.nombre.replace('Función: ', ''));
    expect(enPlano.slice().sort()).toEqual(carpetas.slice().sort());
  });
  it('toda tarea programada creada en las migraciones tiene su ficha CRN-NN', () => {
    const sql = fs.readdirSync(path.join(raiz, 'supabase/migrations')).map(f => leer('supabase/migrations/' + f)).join('\n');
    const nombres = [...sql.matchAll(/cron\.schedule\(\s*'([a-z0-9-]+)'/g)].map(m => m[1]);
    const enPlano = reg.piezas.filter(p => p.cron).map(p => p.cron);
    nombres.forEach(n => expect(enPlano, 'tarea «' + n + '» sin ficha en el plano').toContain(n));
  });
  it('los secretos del Vault que usan las tareas aparecen en la ficha DB-03', () => {
    const sql = fs.readdirSync(path.join(raiz, 'supabase/migrations')).map(f => leer('supabase/migrations/' + f)).join('\n');
    const nombres = new Set([...sql.matchAll(/'((?:[a-z]+_)+cron_secret)'/g)].map(m => m[1]));
    const db03 = reg.piezas.find(p => p.id === 'DB-03').que_es;
    nombres.forEach(n => expect(db03, n).toContain(n));
  });
  it('los servicios externos que llaman las funciones tienen su ficha EXT', () => {
    const codigo = fs.readdirSync(path.join(raiz, 'supabase/functions')).filter(d => d !== '_shared').map(d => leer('supabase/functions/' + d + '/index.ts')).join('\n');
    const exts = reg.piezas.filter(p => p.id.startsWith('EXT-')).map(p => p.id);
    if (codigo.includes('api.resend.com')) expect(exts).toContain('EXT-01');
    if (codigo.includes('generativelanguage.googleapis.com')) expect(exts).toContain('EXT-02');
    if (codigo.includes('api.twilio.com')) expect(exts).toContain('EXT-03');
    if (codigo.includes('challenges.cloudflare.com')) expect(exts).toContain('EXT-04');
    if (/ANTHROPIC_API_KEY/.test(codigo + leer('supabase/functions/_shared/interpretarConIA.ts'))) expect(exts).toContain('EXT-05');
  });
  it('vercel.json: lo que permite la CSP está cubierto por una ficha (Supabase, Sentry, Turnstile)', () => {
    const csp = leer('vercel.json');
    expect(csp).toContain('supabase.co'); expect(csp).toContain('sentry.io'); expect(csp).toContain('challenges.cloudflare.com');
    expect(ids).toEqual(expect.arrayContaining(['HOS-02', 'EXT-06', 'EXT-04']));
  });
});

describe('plano de fallas: lo generado está al día', () => {
  it('docs/plano-fallas.html y .md coinciden con lo que genera el script desde el JSON', () => {
    let salida = '';
    try { salida = execFileSync('python3', ['scripts/generar_plano_fallas.py', '--check', raiz], { cwd: raiz, encoding: 'utf8' }); }
    catch (e) { salida = String(e.stdout || e.message); }
    expect(salida.trim()).toBe('ok');
  });
});
