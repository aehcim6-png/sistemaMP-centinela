// Genera docs/diccionario-mecanico.md: la lista legible de qué palabra lleva a qué componente al
// leer una OT del histórico (diccionario de la app + extensión del histórico + eventos).
// Uso: node scripts/generar_diccionario_mecanico.js   (tests/claseOTHist.test.js vigila que esté al día)
const fs = require('fs');
const path = require('path');
const L = require('../logic.js');
const clave = (k) => (k instanceof RegExp ? '`/' + k.source + '/`' : '`' + k + '`');
function tabla(titulo, lista, nota) {
  const filas = lista.map(([n, ks]) => '| ' + n + ' | ' + ks.map(clave).join(', ') + ' |');
  return ['### ' + titulo, '', nota, '', '| Sistema / componente | Palabras que lo identifican |', '|---|---|', ...filas, ''].join('\n');
}
function generar() {
  return [
    '# Diccionario mecánico de las órdenes de trabajo',
    '',
    'Qué palabra del texto de una OT lleva a qué sistema o componente. Se aplica en este orden y gana la primera coincidencia. Generado por `scripts/generar_diccionario_mecanico.js` desde `logic.js`: no se edita a mano.',
    '',
    tabla('1. Operacional (se mira primero)', L._CATEGORIAS_OPERACIONAL, 'Eventos que no son una falla mecánica: la OT queda con clase `operacional` y no cuenta como falla.'),
    tabla('2. Componentes de la app', L._CATEGORIAS_COMPONENTE, 'El diccionario que usa la app para las OT en vivo (copias exactas en las Edge Functions de WhatsApp y alertas).'),
    tabla('3. Extensión para el histórico', L._CATEGORIAS_COMPONENTE_HIST, 'Vocabulario de la planta sacado de leer las OT de Disponibilidad Mecánica y del Excel. «Rodado» es el rodillo y tren de rodaje del bulldozer (elemento de desgaste); AFEX es el sistema contra incendio; «dar partida» y «código activo» son eléctricos.'),
    tabla('4. Otros eventos', L._CATEGORIAS_EVENTO, 'Si no hay componente, se anota el tipo de evento. Si el texto solo dice «fuera de servicio», el sistema queda vacío: no se inventa.'),
  ].join('\n');
}
if (require.main === module) fs.writeFileSync(path.join(__dirname, '..', 'docs', 'diccionario-mecanico.md'), generar());
module.exports = { generar };
