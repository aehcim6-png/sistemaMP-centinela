import { describe, it, expect } from 'vitest';
import { pestanaDesdeHash, enlacePestana } from '../logic.js';

// Enlaces directos a cada pestaña (5-nov-2026): .../#kpi entra directo a esa pestaña después de iniciar sesión.
const IDS = ['dash', 'eq', 'kpi', 'metas', 'cos', 'hist', 'ayuda'];

describe('pestanaDesdeHash', () => {
  it('lee el id de la pestaña del «#»', () => {
    expect(pestanaDesdeHash('#kpi', IDS)).toBe('kpi');
    expect(pestanaDesdeHash('#/cos', IDS)).toBe('cos');
    expect(pestanaDesdeHash('#KPI', IDS)).toBe('kpi');
    expect(pestanaDesdeHash(' #hist ', IDS)).toBe('hist');
  });
  it('un id que no es una pestaña permitida se ignora', () => {
    expect(pestanaDesdeHash('#cfg', IDS)).toBe('');          // no está en la lista que se le pasa (p. ej. Configuración o una pestaña sin permiso)
    expect(pestanaDesdeHash('#inexistente', IDS)).toBe('');
  });
  it('los anclajes del manual (#m32) y otros usos del «#» no se confunden con una pestaña', () => {
    expect(pestanaDesdeHash('#m32', IDS)).toBe('');
    expect(pestanaDesdeHash('#access_token=abc&type=recovery', IDS)).toBe('');
    expect(pestanaDesdeHash('', IDS)).toBe('');
    expect(pestanaDesdeHash(undefined, IDS)).toBe('');
    expect(pestanaDesdeHash('#kpi', undefined)).toBe('');
  });
  it('no deja pasar texto raro', () => {
    expect(pestanaDesdeHash('#kpi<script>', IDS)).toBe('');
    expect(pestanaDesdeHash('#kpi/otro', IDS)).toBe('');
  });
});

describe('enlacePestana', () => {
  it('arma origen + ruta + «#» + id, sin parámetros viejos', () => {
    expect(enlacePestana('https://sistema-mp-centinela.vercel.app/', 'kpi')).toBe('https://sistema-mp-centinela.vercel.app/#kpi');
    expect(enlacePestana('https://x.app/?eq=CA-1#dash', 'cos')).toBe('https://x.app/#cos');
  });
  it('sin id devuelve la dirección base', () => {
    expect(enlacePestana('https://x.app/', '')).toBe('https://x.app/');
    expect(enlacePestana(undefined, 'kpi')).toBe('#kpi');
  });
});
