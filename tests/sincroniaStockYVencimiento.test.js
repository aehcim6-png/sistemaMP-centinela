const fs = require('fs');
const path = require('path');
const { stockEstado, vencEstado } = require('../logic.js');

// Guardarraíl automático (2026-08-30, mismo espíritu que
// sincroniaComponenteBackend.test.js): alerta-pm/index.ts (el correo diario
// de mantención) NO puede importar logic.js (Deno no puede importar un
// archivo CommonJS/browser), así que reimplementa a mano las mismas reglas
// de negocio de compra de stock (stockEstado) y vencimiento de documentos
// (vencEstado) que ya existen en logic.js y se ven en el Dashboard. Si esas
// reglas cambian en logic.js (ej. el umbral de "2 meses de cobertura", o los
// 30 días de vencimiento) y la copia del correo no se actualiza, el correo
// diario le diría al jefe de mantención algo distinto de lo que muestra la
// pantalla — silenciosamente, porque nada fallaría, solo darían resultados
// distintos ante los mismos datos.
// Este test corre las DOS implementaciones con la MISMA batería de casos
// reales/límite y exige que el nivel/estado de decisión coincida siempre.

function extraerFuncionDeArchivo(rutaRelativa, nombreFuncion) {
  const ruta = path.join(__dirname, '..', rutaRelativa);
  const txt = fs.readFileSync(ruta, 'utf8');
  const marcador = `function ${nombreFuncion}(`;
  const idxInicio = txt.indexOf(marcador);
  if (idxInicio < 0) {
    throw new Error(`No se encontró "${marcador}" en ${rutaRelativa} — ¿se renombró la función?`);
  }
  const idxLlave = txt.indexOf('{', idxInicio);
  let profundidad = 0, fin = -1;
  for (let i = idxLlave; i < txt.length; i++) {
    if (txt[i] === '{') profundidad++;
    else if (txt[i] === '}') { profundidad--; if (profundidad === 0) { fin = i; break; } }
  }
  if (fin < 0) throw new Error(`Función sin cerrar: "${marcador}" en ${rutaRelativa}`);
  // Quita anotaciones de tipo TS (parámetros ": number", "| null", y
  // aserciones "as Tipo" dentro del cuerpo, ej. "null as number | null")
  // que rompen un eval como JS plano — la LÓGICA real que nos interesa
  // comparar ya es JS válido sin ellas.
  const cabecera = txt.slice(idxInicio, idxLlave)
    .replace(/:\s*[A-Za-z0-9_<>\[\]| ]+(?=[,)])/g, '')
    .replace(/\)\s*:\s*[A-Za-z0-9_<>\[\]| ]+$/, ')');
  const cuerpo = txt.slice(idxLlave, fin + 1)
    .replace(/\s+as\s+[A-Za-z0-9_<>\[\]| ]+(?=[,;)}\n])/g, '');
  // eslint-disable-next-line no-eval
  return eval(`(${cabecera}${cuerpo})`);
}

describe('Sincronía de stockEstado/vencEstado entre logic.js y alerta-pm/index.ts', () => {
  const calcStockEstado = extraerFuncionDeArchivo('supabase/functions/alerta-pm/index.ts', 'calcStockEstado');
  const calcVencEstado = extraerFuncionDeArchivo('supabase/functions/alerta-pm/index.ts', 'calcVencEstado');

  it('calcStockEstado (alerta-pm) decide lo MISMO (nivel + meses) que stockEstado (logic.js) en casos reales/límite', () => {
    const casos = [
      // [stockBodega, consumoMes, leadDias]
      [0, 0, null],       // sin stock, sin consumo
      [50, 0, null],      // stock pero sin consumo -> OK (nada que proyectar)
      [0, 10, null],      // sin stock, con consumo -> COMPRAR
      [5, 10, null],      // stock bajo, lead default 34d -> COMPRAR
      [20, 10, 34],       // justo en el borde del lead time
      [25, 10, 15],       // cobertura > lead pero < 2 meses -> BAJO
      [40, 10, 15],       // cobertura holgada -> OK
      [100, 5, 45],       // lead time largo
    ];
    for (const [stockBodega, consumoMes, leadDias] of casos) {
      const a = stockEstado(stockBodega, consumoMes, leadDias);
      const b = calcStockEstado(stockBodega, consumoMes, leadDias);
      expect({ nivel: b.nivel, meses: b.meses }, `caso [${stockBodega},${consumoMes},${leadDias}]`)
        .toEqual({ nivel: a.nivel, meses: a.meses });
    }
  });

  it('calcVencEstado (alerta-pm) decide lo MISMO (vencido/requiereAtencion/dias) que vencEstado (logic.js) en casos reales/límite', () => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const iso = (deltaDias) => new Date(hoy.getTime() + deltaDias * 86400000).toISOString().slice(0, 10);
    const casos = [null, iso(-10), iso(-1), iso(0), iso(1), iso(29), iso(30), iso(31), iso(90)];
    for (const fecha of casos) {
      for (const tieneRegla of [true, false]) {
        const a = vencEstado(fecha, tieneRegla);
        const b = calcVencEstado(fecha, tieneRegla);
        expect({ dias: b.dias, requiereAtencion: b.requiereAtencion, vencido: b.vencido }, `caso fecha=${fecha}, tieneRegla=${tieneRegla}`)
          .toEqual({ dias: a.dias, requiereAtencion: a.requiereAtencion, vencido: fecha ? a.dias < 0 : false });
      }
    }
  });
});
