// Datos para la revisión cruzada de coherencia (tests/e2e/coherencia-cruzada.spec.js).
// Parte de la flota real que viene en index.html (INIT: 27 equipos, registros de PM, historial de horómetros,
// neumáticos, stock y lubricantes) y le suma datos sintéticos deterministas — correctivos, una salida de servicio abierta
// y un informe de falla catastrófica — para que todas las pantallas tengan algo que mostrar. Las fechas son relativas a hoy.
const fs = require('fs');
const path = require('path');

function iso(d) { return d.toISOString().slice(0, 10); }
function sumarDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function sintetizarFlota(INIT, hoy) {
  const estados = ['🔴 URGENTE', '🟡 PRÓXIMA', '🟢 AL DÍA'];
  for (let k = 0; k < 12; k++) {
    const hor = 5000 + k * 700;
    INIT.equipos.push({
      sigla: 'CN-' + (9001 + k), tipo: 'Camion', modelo: 'Komatsu HD785-7', hrsDia: 16, horomActual: hor, fechaHorom: iso(hoy), frecPM: 250,
      horomProxPM: Math.ceil((hor + 1) / 250) * 250, hrsRestantes: 100, diasParaPM: 6, fechaProxPM: iso(sumarDias(hoy, 6)), tipoPM: 'PM1', estado: estados[k % 3],
    });
    for (let d = 0; d < 40; d++) {
      const h = hor - (40 - d) * 16;
      INIT.historial.push({ sigla: 'CN-' + (9001 + k), fecha: iso(sumarDias(hoy, d - 40)), horomIni: h, horomFin: h + 16, horom: h + 16 });
    }
    for (let j = 0; j < 4; j++) {
      INIT.registros.push({
        nReg: k * 4 + j + 1, equipo: 'CN-' + (9001 + k), tipoPM: 'PM1', fechaEntrada: iso(sumarDias(hoy, -(30 + j * 60))), horaEntrada: '08:00',
        fechaSalida: iso(sumarDias(hoy, -(30 + j * 60))), horaSalida: '10:00', duracion: '02:00', duracionH: 2, horomReal: hor - 400 - j * 250,
        estatusEq: 'Operativo', tecnico: 'T' + (k % 3), obs: 'PM',
      });
    }
  }
}

function construirDatos() {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'index.html'), 'utf8');
  const INIT = JSON.parse(html.match(/const INIT=(\{.*?\});\n/s)[1]);
  const hoy = new Date();
  // sistema-mp2 parte vacío (INIT sin equipos): ahí la flota completa es sintética.
  if (!INIT.equipos.length) sintetizarFlota(INIT, hoy);
  const equipos = INIT.equipos.map(function (e) { return Object.assign({}, e); });
  const porHoras = equipos.filter(function (e) { return e.unidad !== 'km' && e.horomActual > 2000; }).slice(0, 8);
  const correctivos = [];
  let n = 1;
  porHoras.forEach(function (e, k) {
    for (let j = 0; j < 5; j++) {
      const f = iso(sumarDias(hoy, -(20 + j * 60 + k * 3)));
      // dos de cada cinco correctivos son paradas largas (≥ 24 h): MTBF y MTTR se miden solo sobre esas (PARADA_LARGA_H); el resto son intervenciones menores
      const dur = (j % 5 < 2) ? 30 + k * 6 + j * 5 : 2 + ((k + j) % 5) * 3;
      correctivos.push({
        id: 'o' + (n++), sigla: e.sigla, tipo: 'Correctivo', criticidad: 'Alta', fecha: f, fechaEntrada: f, horaEntrada: '08:00',
        fechaSalida: f, horaSalida: ('0' + (8 + dur) % 24).slice(-2) + ':00', duracion: dur + 'h 0m',
        horom: Math.max(100, Math.round(e.horomActual - (j * 430 + k * 17))), sintoma: 'Falla ' + j, sistema: 'Motor',
        tecnico: 'T' + (k % 3), estadoOT: 'Cerrada', componente: j % 2 ? 'Turbo' : 'Alternador', costo: 0,
      });
    }
  });
  const f3 = iso(sumarDias(hoy, -3));
  correctivos.push({
    id: 'o' + (n++), sigla: porHoras[0].sigla, tipo: 'Fuera de Servicio', estatusEq: 'Fuera de Servicio', criticidad: 'Reparación Inmediata', fecha: f3, fechaEntrada: f3,
    horaEntrada: '07:00', duracion: '', horom: porHoras[0].horomActual, sintoma: 'Sin motor', sistema: 'Motor', tecnico: 'T1',
    estadoOT: 'En Ejecución', costo: 0,
  });
  // Falla catastrófica de un informe (no es una OT): debe contar como falla en TODAS las pantallas que cuentan fallas.
  const informes = [{
    id: 'i1', sigla: porHoras[1].sigla, tipoEvento: 'Falla Catastrófica', componente: 'Turbo', fecha: iso(sumarDias(hoy, -15)),
    horometroActual: porHoras[1].horomActual - 5, descripcion: 'Rotura mayor',
  }];
  // PM del mes en curso con desvío real (2 de cada 3 a tiempo) para que el % de cumplimiento tenga qué mostrar.
  const registros = INIT.registros.map(function (r) { return Object.assign({}, r); });
  const mes = iso(hoy).slice(0, 7);
  registros.slice(0, 30).forEach(function (r, i) {
    const dia = ('0' + (1 + (i % 12))).slice(-2);
    r.fechaEntrada = mes + '-' + dia; r.fechaSalida = mes + '-' + dia; r.desvioDias = (i % 3 === 2) ? 3 : 0; // se guarda en la base: debe sobrevivir a la carga
  });
  return {
    equipos, correctivos, informes, registros,
    historial: INIT.historial.map(function (h, i) { return Object.assign({ id: 'h' + i }, h); }),
    neumaticos: INIT.neumaticos, stock: INIT.stockFiltros, lubricantes: INIT.lubricantes,
  };
}
module.exports = { construirDatos };
