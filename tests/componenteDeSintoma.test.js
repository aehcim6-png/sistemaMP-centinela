const { _componenteDeSintoma } = require('../logic.js');

describe('_componenteDeSintoma', () => {
  it('devuelve vacío para texto vacío o nulo', () => {
    expect(_componenteDeSintoma('')).toBe('');
    expect(_componenteDeSintoma(null)).toBe('');
    expect(_componenteDeSintoma(undefined)).toBe('');
  });

  it('clasifica variantes de mayúsculas/minúsculas y con/sin tilde igual', () => {
    expect(_componenteDeSintoma('ASIENTO NO FUNCIONAL')).toBe('Asiento');
    expect(_componenteDeSintoma('asiento con falla en respaldar')).toBe('Asiento');
    expect(_componenteDeSintoma('Bateria descargada')).toBe('Batería');
    expect(_componenteDeSintoma('batería agotada')).toBe('Batería');
  });

  it('clasifica síntomas reales de neumáticos, incluyendo presión sin la palabra "neumático" (2026-08-28)', () => {
    expect(_componenteDeSintoma('Despresurizacion')).toBe('Neumáticos');
    expect(_componenteDeSintoma('Despresurizacion neumaticos')).toBe('Neumáticos');
    expect(_componenteDeSintoma('desprezurizacion')).toBe('Neumáticos'); // typo real visto en los datos
    expect(_componenteDeSintoma('PRESURIZACION NEUMATICO POSICION 1')).toBe('Neumáticos');
    expect(_componenteDeSintoma('Chequeo neumaticos')).toBe('Neumáticos');
  });

  it('clasifica la forma femenina de "eléctrica" (2026-08-28, antes solo reconocía "eléctrico")', () => {
    expect(_componenteDeSintoma('Falla eléctrica')).toBe('Sistema Eléctrico');
    expect(_componenteDeSintoma('falla electrica')).toBe('Sistema Eléctrico');
    expect(_componenteDeSintoma('Corte eléctrico')).toBe('Sistema Eléctrico');
    expect(_componenteDeSintoma('Bocina no funciona')).toBe('Sistema Eléctrico');
  });

  it('separa Engrase/Lubricación de una falla real de componente (2026-08-28, categoría nueva)', () => {
    expect(_componenteDeSintoma('Engrase General')).toBe('Engrase/Lubricación');
    expect(_componenteDeSintoma('ENGRASE GENERAL')).toBe('Engrase/Lubricación');
    expect(_componenteDeSintoma('Relleno de grasa')).toBe('Engrase/Lubricación');
    expect(_componenteDeSintoma('se carga tk de grasa')).toBe('Engrase/Lubricación');
  });

  it('separa Fuga de Aceite de Mangueras/Fugas — son causas raíz físicamente distintas (2026-08-28)', () => {
    expect(_componenteDeSintoma('Fuga aceite')).toBe('Fuga de Aceite');
    expect(_componenteDeSintoma('Fuga de aceite')).toBe('Fuga de Aceite');
    expect(_componenteDeSintoma('manguera hidraulica rota')).toBe('Mangueras/Fugas');
  });

  it('clasifica la variante real "perno de bomba inyeccion" (2026-08-28)', () => {
    expect(_componenteDeSintoma('Perno de bomba inyeccion cortado')).toBe('Bomba de Combustible');
  });

  it('deja sin categoría los síntomas que genuinamente no son una falla de componente (correcto, no es un hueco a rellenar)', () => {
    expect(_componenteDeSintoma('Mantenimiento preventivo')).toBe('');
    expect(_componenteDeSintoma('Cierre de Backlog')).toBe('');
    expect(_componenteDeSintoma('se da partida a equipo')).toBe('');
    expect(_componenteDeSintoma('Codigo activo')).toBe('');
  });

  it('prioriza las categorías específicas por sobre "Motor" genérico', () => {
    expect(_componenteDeSintoma('motor de partida no arranca')).toBe('Motor de Partida');
    expect(_componenteDeSintoma('falla de motor')).toBe('Motor');
  });

  it('mantiene las categorías del Tren de Rodaje (bulldozers) intactas', () => {
    expect(_componenteDeSintoma('tensado de cadena')).toBe('Tren de Rodaje');
    expect(_componenteDeSintoma('pernos sueltos de rueda motriz')).toBe('Tren de Rodaje');
  });
});
