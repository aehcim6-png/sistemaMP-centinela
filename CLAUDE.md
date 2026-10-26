# SistemaMP — guía para Claude

Sistema de gestión de mantenimiento de flota (app web de JavaScript sin framework + Supabase + Vercel). Este repositorio y su gemelo `sistema-mp2` comparten el mismo código y se mantienen en paralelo.

## Si algo falla: no hagas una auditoría general, usa el plano de fallas

Hay un mapa de todas las piezas del sistema con un **código** cada una (como el rotulado de un tablero eléctrico). Ante cualquier falla:

1. Lee `docs/plano-fallas.md` → tabla **«Si ves esto, mira primero…»**: de lo que se ve (o de lo que reportó la persona) te da el código y el orden en que mirar. Ejemplos: `HOS-01` Vercel, `AUT-01` login, `DB-01` base, `DB-02` permisos, `EF-05` función backup-diario, `CRN-01` tarea programada, `EXT-01` Resend.
2. Abre la ficha de ese código (`### CÓDIGO — …`). Trae dónde está (panel, ruta en el repo), cómo se ve cuando falla, cómo confirmarlo en orden y los comandos de **«Soporte técnico (Claude)»** (SQL y llamadas a las herramientas de Supabase / Vercel / GitHub).
3. **Si es una tarea programada** (respaldo, alertas, resumen, vigilante): lo primero es `select nombre, "ultimaEjecucion", exito, detalle from public.salud_crons;` en el proyecto correcto (`MON-01`).
4. ¿Hubo un cambio reciente? Compara `git log origin/main` con el último despliegue de Vercel (`HOS-01`) y con las migraciones nuevas.
5. Informa con el **código** y la evidencia («EF-05: el log de backup-diario dice …»). No apliques arreglos sin que te lo pidan: las rutinas de diagnóstico (`MON-02`) son de solo lectura.

Proyectos (también en la tabla de `docs/plano-fallas.md`):

| | Supabase (ref) | Vercel | Repositorio |
|---|---|---|---|
| Centinela | `jyhpfwivhwzylkzxrsbt` | `sistema-mp-centinela` | `aehcim6-png/sistemamp-centinela` |
| sistema-mp2 | `mzboxosxbaqtysuqdohj` | `sistema-mp2` | `aehcim6-png/sistema-mp2` |

### Mantener el plano al día

La fuente es `docs/plano-fallas.json`; `docs/plano-fallas.html` y `.md` se **generan** con `python3 scripts/generar_plano_fallas.py` (no se editan a mano). Si agregas una Edge Function, una tarea programada (`cron.schedule`), un servicio externo o un secreto del Vault, agrega su ficha en el JSON y regenera: `tests/planFallas.test.js` falla si el repositorio y el plano dejan de coincidir.

## Convenciones del proyecto

- Idioma: español, conciso y honesto con los límites; no inventar datos; no mostrar secretos.
- Pruebas: `npx vitest run` (unitarias, `tests/*.test.js`) y `npx playwright test` (e2e, `tests/e2e`; en este entorno `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium`).
- Toda tabla o función nueva en `public` lleva sus `GRANT` en la misma migración (`tests/migracionesGrants.test.js`); toda tabla nueva va también a `TABLAS` de `supabase/functions/backup-diario`.
- Cálculos y reglas en `logic.js` (con su prueba); pantallas en `modules/renders/*.js`; guardado en `modules/store.js`. Todo cambio relevante se documenta en `docs/arquitectura.md` (y su `.html`), el manual y el inventario de algoritmos.
