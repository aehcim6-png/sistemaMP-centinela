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

  it('clasifica el verbo conjugado "se presuriza"/"se despresuriza", no solo el sustantivo (2026-08-28, segunda pasada)', () => {
    expect(_componenteDeSintoma('se presuriza posicion 3')).toBe('Neumáticos');
    expect(_componenteDeSintoma('se presuriza posicion 4 /6')).toBe('Neumáticos');
    expect(_componenteDeSintoma('se despresuriza posicion 2')).toBe('Neumáticos');
  });

  it('clasifica variantes de plural/espaciado/typo reales de la segunda pasada (2026-08-28)', () => {
    expect(_componenteDeSintoma('soportes de cabina')).toBe('Soporte de Cabina');
    expect(_componenteDeSintoma('elementos desgaste')).toBe('Elemento de Desgaste');
    expect(_componenteDeSintoma('se reemplaza filtro decombustible y se puraga sistema')).toBe('Filtro de Combustible');
    expect(_componenteDeSintoma('se realiza limpieza de enfriadores')).toBe('Radiador/Enfriamiento');
    expect(_componenteDeSintoma('cañeria de refrigeracion rota')).toBe('Radiador/Enfriamiento');
  });

  it('clasifica variantes reales de Aire Acondicionado sin espacios alrededor de "a/c" (2026-08-28)', () => {
    expect(_componenteDeSintoma('se carga ac')).toBe('Aire Acondicionado');
    expect(_componenteDeSintoma('chequeo a/c')).toBe('Aire Acondicionado');
    expect(_componenteDeSintoma('bajo flujo de a/c')).toBe('Aire Acondicionado');
  });

  it('NO clasifica "acblue" (AdBlue) como Aire Acondicionado — evita el falso positivo de la sigla "ac" sola', () => {
    expect(_componenteDeSintoma('bajo flujo de acblue')).toBe('');
  });

  it('clasifica la categoría nueva Radio/Comunicaciones (2026-08-28)', () => {
    expect(_componenteDeSintoma('falla en radio base')).toBe('Radio/Comunicaciones');
    expect(_componenteDeSintoma('falla ptt radio,se cambia')).toBe('Radio/Comunicaciones');
  });

  it('clasifica "suspencion" (typo con "c") como Suspensión, salvo cuando es del asiento (2026-08-28, tercera pasada)', () => {
    expect(_componenteDeSintoma('carga nitrogeno a suspencion trasera izq')).toBe('Suspensión');
    expect(_componenteDeSintoma('suspencion trasera lado izq con fuga')).toBe('Suspensión');
    // "Asiento" gana primero porque está antes en la lista — es correcto,
    // es la suspensión neumática del asiento, no la del equipo.
    expect(_componenteDeSintoma('se repara cable de suspencion neumatica de asiento')).toBe('Asiento');
  });

  it('unifica Crucetas/Cardán — mismo conjunto mecánico (2026-08-28, tercera pasada)', () => {
    expect(_componenteDeSintoma('se desmonta cardan y se evidencia desgaste en polines de crucetas')).toBe('Crucetas/Cardán');
    expect(_componenteDeSintoma('cruceta trasera con juego')).toBe('Crucetas/Cardán');
  });

  it('amplía Mangueras/Fugas a "flexible" (palabra sola) y "cañería" (2026-08-28, tercera pasada)', () => {
    expect(_componenteDeSintoma('flexible hidraulico dañado')).toBe('Mangueras/Fugas');
    expect(_componenteDeSintoma('cañeria de combustible fisurada')).toBe('Mangueras/Fugas');
    expect(_componenteDeSintoma('oring de cañeria direccon en mal estado')).toBe('Mangueras/Fugas');
    // Cuando el síntoma ya apunta a un sistema más específico (Frenos,
    // listado antes en la lista), esa categoría gana primero — Mangueras/
    // Fugas queda como la genérica para cuando no hay una más precisa.
    expect(_componenteDeSintoma('se cambia flexible de freno')).toBe('Frenos');
  });

  it('clasifica la categoría nueva Tornamesa/Giro (2026-08-28, tercera pasada)', () => {
    expect(_componenteDeSintoma('cambio deslizaderas tornamesa')).toBe('Tornamesa/Giro');
  });

  it('NO inventa categorías para términos sin evidencia real en la base (2026-08-28, tercera pasada)', () => {
    // 'lainas' y 'bomba centrífuga' no aparecen ni una vez en los 1.243
    // correctivos reales — verificado por SQL antes de decidir no agregarlos.
    expect(_componenteDeSintoma('cambio de lainas')).toBe('');
    expect(_componenteDeSintoma('falla bomba centrifuga')).toBe('');
  });

  it('deja "sensor"/"válvula" sin categoría — cruzan demasiados sistemas distintos para clasificar con confianza', () => {
    expect(_componenteDeSintoma('sensor de levante sucio, se limpia')).toBe('');
    expect(_componenteDeSintoma('cambio valvula de carga')).toBe('');
  });

  it('clasifica "foco" sin especificar posición como Foco/Ampolleta (2026-08-28, cuarta pasada)', () => {
    expect(_componenteDeSintoma('se normaliza foco central derecho')).toBe('Foco/Ampolleta');
    expect(_componenteDeSintoma('se normaliza funcionamiento de focos trasero')).toBe('Foco/Ampolleta');
  });

  it('clasifica "orbitrol" como parte de la dirección hidráulica (2026-08-28, cuarta pasada)', () => {
    expect(_componenteDeSintoma('fuga orbitrol')).toBe('Cilindro de Dirección');
    expect(_componenteDeSintoma('se reapreta manguera de orbitrol')).toBe('Cilindro de Dirección');
  });

  it('clasifica las categorías nuevas Sistema AFEX y Estanque/Tapa de Combustible (2026-08-28, cuarta pasada)', () => {
    expect(_componenteDeSintoma('se normaliza sistema afex')).toBe('Sistema AFEX (Extinción de Incendios)');
    expect(_componenteDeSintoma('falta de tapa combustible')).toBe('Estanque/Tapa de Combustible');
    expect(_componenteDeSintoma('estanque de combustible ,no funcional')).toBe('Estanque/Tapa de Combustible');
  });

  it('clasifica el plural "filtros de combustible" (2026-08-28, cuarta pasada)', () => {
    expect(_componenteDeSintoma('se realiza cambio de filtros de combustible')).toBe('Filtro de Combustible');
  });

  it('NO inventa "plumilla" — cero ocurrencias reales en la base (2026-08-28, cuarta pasada)', () => {
    expect(_componenteDeSintoma('cambio de plumilla')).toBe('');
  });

  it('confirma que "engrase"/"relleno"/"ampolleta" ya estaban cubiertas antes de esta pasada (sin cambios)', () => {
    expect(_componenteDeSintoma('engrase general')).toBe('Engrase/Lubricación');
    expect(_componenteDeSintoma('relleno de grasa')).toBe('Engrase/Lubricación');
    expect(_componenteDeSintoma('ampolleta quemada')).toBe('Foco/Ampolleta');
  });

  it('confirma que "orbitrol" sigue clasificando como dirección (2026-08-28, quinta pasada — el usuario confirmó que es correcto)', () => {
    expect(_componenteDeSintoma('falla en orbitrol')).toBe('Cilindro de Dirección');
  });

  it('clasifica "correa" de accesorios sin competir con Alternador ya existente (2026-08-28, quinta pasada)', () => {
    expect(_componenteDeSintoma('correa alternador')).toBe('Alternador'); // sin cambios
    expect(_componenteDeSintoma('se cambia correa del ventilador')).toBe('Correas');
    expect(_componenteDeSintoma('correa compresor en mal estado/se cambia')).toBe('Correas');
  });

  it('clasifica "entrecalza"/"entrecalzas" como GET/Cuchillas (2026-08-28, quinta pasada)', () => {
    expect(_componenteDeSintoma('cambio juego entrecalzas')).toBe('GET / Cuchillas');
    expect(_componenteDeSintoma('se desprende entrecalza central/se repone')).toBe('GET / Cuchillas');
  });

  it('amplía Radio/Comunicaciones a "antena" sin "radio base" cerca (2026-08-28, quinta pasada)', () => {
    expect(_componenteDeSintoma('falla cable antena')).toBe('Radio/Comunicaciones');
  });

  it('clasifica la categoría nueva Sistema Anticolisión/Fatiga (ADAS) (2026-08-28, quinta pasada)', () => {
    expect(_componenteDeSintoma('sistema anticolision')).toBe('Sistema Anticolisión/Fatiga (ADAS)');
    expect(_componenteDeSintoma('se calibra sistema de somnolencia')).toBe('Sistema Anticolisión/Fatiga (ADAS)');
  });

  it('clasifica "kick dawn"/"pick dawn" (grafía real del kickdown) como Transmisión (2026-08-28, quinta pasada)', () => {
    expect(_componenteDeSintoma('se instala palanca  kick dawn')).toBe('Transmisión');
  });

  it('NO inventa "carrilera"/"fusible"/"reflectores" — sin evidencia real (2026-08-28, quinta pasada)', () => {
    expect(_componenteDeSintoma('cambio de carrilera')).toBe('');
    expect(_componenteDeSintoma('fusible quemado')).toBe('');
    expect(_componenteDeSintoma('cinta reflectores dañada')).toBe('');
  });

  it('"valvula corta/larga de neumático" ya clasifica bien por la palabra "neumático" — la frase exacta con "válvula" no aparece en la base, pero no hace falta agregarla', () => {
    expect(_componenteDeSintoma('cambio de valvula corta de neumatico')).toBe('Neumáticos');
  });

  it('confirma que "acumulador de freno" ya quedaba cubierto por Frenos (sin cambios necesarios)', () => {
    expect(_componenteDeSintoma('acumulador de freno  bajo,se carga')).toBe('Frenos');
  });
});
