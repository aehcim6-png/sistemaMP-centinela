import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { claseOTDesdeTexto, esFallaOTHist, soloFallasOTHist, _otHistComoOt, esFallaMTBF, _componenteDeSintoma, sistemaDeTextoHist } = require('../logic.js');
const { funcionSQL, funcionSistemaSQL, funcionClasificarSQL } = require('../scripts/generar_componente_sql.js');
const { generar: generarDiccionario } = require('../scripts/generar_diccionario_mecanico.js');

// Las OT del Excel marcan «Correctiva» tareas que son rutina preventiva, cambios de desgaste o
// instalaciones (2026-11-07: ~35 % eran preventivas rutinarias). claseOT las separa sin tocar tipoInt.
describe('claseOTDesdeTexto', () => {
  it('rutina preventiva: control de neumáticos, presurizado, engrase, mantención semanal', () => {
    expect(claseOTDesdeTexto('Control de neumáticos')).toBe('preventiva');
    expect(claseOTDesdeTexto('Se realiza presurización neumático posición 1')).toBe('preventiva');
    expect(claseOTDesdeTexto('Se realiza engrase punto a punto de balde y relleno de aceite motor')).toBe('preventiva');
    expect(claseOTDesdeTexto('Mantención semanal')).toBe('preventiva');
  });
  it('desgaste planificado: cuchillas, entredientes, puntas de ripper', () => {
    expect(claseOTDesdeTexto('Se realiza cambio de cuchillas')).toBe('desgaste');
    expect(claseOTDesdeTexto('Reposicion de entrediente')).toBe('desgaste');
    expect(claseOTDesdeTexto('Cambio de puntas del ripper')).toBe('desgaste');
  });
  it('instalación o mejora: solo cuando hay verbo de instalar Y un objeto, sin palabra de falla', () => {
    expect(claseOTDesdeTexto('Se instala sistema de antisomnolencia')).toBe('instalacion');
    expect(claseOTDesdeTexto('Se realiza polarizado de parabrisas')).toBe('instalacion');
    expect(claseOTDesdeTexto('Se repara antena de radio base por corte eléctrico')).toBe('correctiva');
  });
  it('una palabra de falla gana sobre la rutina', () => {
    expect(claseOTDesdeTexto('Chequeo preventivo: se detecta fuga de aceite hidráulico')).toBe('correctiva');
    expect(claseOTDesdeTexto('Engrase, equipo fuera de servicio por código activo')).toBe('correctiva');
    expect(claseOTDesdeTexto('Cambio de turbo y engrase')).toBe('correctiva');
  });
  it('lo demás es correctiva y el texto vacío nunca inventa otra clase', () => {
    expect(claseOTDesdeTexto('CE-87 fuera de servicio por fuga de aceite hidráulico')).toBe('correctiva');
    expect(claseOTDesdeTexto('')).toBe('correctiva');
    expect(claseOTDesdeTexto(null)).toBe('correctiva');
  });
  it('tipoInt Programada o Predictiva es preventiva aunque el texto no lo diga', () => {
    expect(claseOTDesdeTexto('Equipo con PM4 en proceso', 'Programada')).toBe('preventiva');
    expect(claseOTDesdeTexto('lo que sea', 'Predictiva')).toBe('preventiva');
  });
  it('«dañadas» no se confunde con la sigla ADAS', () => {
    expect(claseOTDesdeTexto('Se instalan mangueras dañadas')).toBe('correctiva');
  });
});

describe('esFallaOTHist / soloFallasOTHist', () => {
  it('usa claseOT cuando está llenada, aunque el texto diga otra cosa', () => {
    expect(esFallaOTHist({ claseOT: 'preventiva', descripcion: 'fuga de aceite' })).toBe(false);
    expect(esFallaOTHist({ claseOT: 'correctiva', descripcion: 'Control de neumáticos' })).toBe(true);
  });
  it('sin claseOT la deduce del texto', () => {
    expect(esFallaOTHist({ descripcion: 'Control de neumáticos', tipoInt: 'Correctiva' })).toBe(false);
    expect(esFallaOTHist({ descripcion: 'Se cambia alternador' })).toBe(true);
    expect(esFallaOTHist(null)).toBe(false);
  });
  it('soloFallasOTHist y _otHistComoOt dejan fuera lo no-falla (así no inflan MTBF ni el ranking)', () => {
    const h = [
      { sigla: 'CN-9500', fecha: '2024-10-01', descripcion: 'Control de neumáticos', claseOT: 'preventiva', sistema: 'Neumáticos' },
      { sigla: 'CN-9500', fecha: '2024-10-02', descripcion: 'Falla alternador', claseOT: 'correctiva', sistema: 'Sist. Eléctrico' },
      { sigla: 'CF-9510', fecha: '2024-10-03', descripcion: 'Cambio de cuchillas', claseOT: 'desgaste', sistema: 'GETS' },
    ];
    expect(soloFallasOTHist(h)).toHaveLength(1);
    const adaptadas = _otHistComoOt(h);
    expect(adaptadas).toHaveLength(1);
    expect(adaptadas[0]).toMatchObject({ sigla: 'CN-9500', fecha: '2024-10-02', tipo: 'Correctivo' });
    expect(esFallaMTBF(adaptadas[0])).toBe(true);
  });
});

describe('clase «operacional» y rutina ampliada (2026-11-07)', () => {
  it('empantanado, siniestro, falta de combustible y turno noche no son fallas mecánicas', () => {
    expect(claseOTDesdeTexto('CAEX 87 fuera de servicio equipo queda empantanado en botadero')).toBe('operacional');
    expect(claseOTDesdeTexto('F/S por siniestro pos. 1')).toBe('operacional');
    expect(claseOTDesdeTexto('F/S por falta combustible.')).toBe('operacional');
    expect(claseOTDesdeTexto('Contractualmente no existe turno noche de mantencion')).toBe('operacional');
    expect(esFallaOTHist({ descripcion: 'Desenterramiento de equipo.' })).toBe(false);
  });
  it('PM, AdBlue y calibración de PLM son rutina', () => {
    expect(claseOTDesdeTexto('MP PM3')).toBe('preventiva');
    expect(claseOTDesdeTexto('Mantención PM1')).toBe('preventiva');
    expect(claseOTDesdeTexto('Relleno de AD BLUE')).toBe('preventiva');
    expect(claseOTDesdeTexto('Calibración de PLM')).toBe('preventiva');
  });
  it('un fuera de servicio con causa mecánica sigue siendo correctiva', () => {
    expect(claseOTDesdeTexto('Equipo fuera de servicio por pernos de rueda cortados')).toBe('correctiva');
    expect(claseOTDesdeTexto('Equipo F/S por falla en electroventilador.')).toBe('correctiva');
  });
  it('«rodado» es desgaste del tren de rodaje (criterio del usuario)', () => {
    expect(claseOTDesdeTexto('equipo fuera de servicio por cambio de rodado')).toBe('desgaste');
  });
});

describe('diccionario de componentes ampliado (OT del histórico sin sistema)', () => {
  const casos = [
    ['Equipo fuera de servicio por pernos de rueda cortados', 'Pernos de Rueda'],
    ['Equipo fuera de servicio por rodado', 'Tren de Rodaje'],
    ['Equipo fuera de servicio por cambio de rodado', 'Tren de Rodaje'],
    ['Alarma sistema AFX', 'Sistema AFEX (Extinción de Incendios)'],
    ['F/S por falta de sistema AFEX', 'Sistema AFEX (Extinción de Incendios)'],
    ['Codigo activo', 'Sistema Eléctrico'],
    ['se da partida a equipo', 'Sistema Eléctrico'],
    ['Equipo fuera de servicio, sin partida', 'Sistema Eléctrico'],
    ['Fuera de servicio por remanente de nemáticos posiciones delanteras', 'Neumáticos'],
    ['Equipo F/S por falla en sistema de regadio.', 'Regadío/Aspersores'],
    ['Se realiza cambio de membrana aspersor trasero izquierdo', 'Regadío/Aspersores'],
    ['Problemas en retardador.', 'Retardador'],
    ['Se realiza reparación de soldadura en guardafangos', 'Estructura/Soldadura'],
    ['Se realiza fabricacion de baranda frontal', 'Estructura/Soldadura'],
    ['Equipo fuera de servicio por retiro de balde', 'Balde/Implemento'],
    ['Se realiza fabricacion de portacuñas', 'Balde/Implemento'],
    ['Reemplazo vicera copiloto', 'Cabina/Carrocería'],
    ['Calibración de PLM', 'PLM (Medidor de Carga)'],
    ['Relleno de AD BLUE', 'AdBlue/SCR'],
  ];
  casos.forEach(([texto, esperado]) => it(texto, () => expect(sistemaDeTextoHist(texto)).toBe(esperado)));
  it('el clasificador en vivo (_componenteDeSintoma) no cambia: lo nuevo es solo para el histórico', () => {
    expect(_componenteDeSintoma('Codigo activo')).toBe('');
    expect(_componenteDeSintoma('se da partida a equipo')).toBe('');
    expect(_componenteDeSintoma('Equipo fuera de servicio por pernos de rueda cortados')).toBe('');
    expect(_componenteDeSintoma('falla bomba centrifuga')).toBe('');
  });
  it('lo que ya clasificaba antes no cambia (las entradas nuevas van al final)', () => {
    expect(sistemaDeTextoHist('Bateria descargada')).toBe('Batería');
    expect(sistemaDeTextoHist('presurizacion neumatico posicion 1')).toBe('Neumáticos');
    expect(sistemaDeTextoHist('falla en turbo')).toBe('Turbo');
  });
  it('un texto que solo dice «fuera de servicio» no inventa componente', () => {
    expect(sistemaDeTextoHist('F/S')).toBe('');
    expect(sistemaDeTextoHist('Equipo fuera de servicio.')).toBe('');
  });
});

describe('sistemaDeTextoHist (sistema para el histórico de OT)', () => {
  it('usa el componente y, si no hay, el tipo de evento', () => {
    expect(sistemaDeTextoHist('Equipo F/S por falla en electroventilador.')).toBe('Radiador/Enfriamiento');
    expect(sistemaDeTextoHist('perdida de potencia')).toBe('Pérdida de Potencia (causa no indicada)');
    expect(sistemaDeTextoHist('MP PM3')).toBe('Mantención Preventiva/PM');
  });
  it('lo operacional gana sobre el componente', () => {
    expect(sistemaDeTextoHist('F/S por falta combustible.')).toBe('Operacional / Externo (no mecánico)');
    expect(sistemaDeTextoHist('F/S por siniestro pos. 1')).toBe('Operacional / Externo (no mecánico)');
    expect(sistemaDeTextoHist('CAEX 87 fuera de servicio equipo queda empantanado en botadero')).toBe('Operacional / Externo (no mecánico)');
  });
  it('vacío o nulo da vacío', () => {
    expect(sistemaDeTextoHist('')).toBe('');
    expect(sistemaDeTextoHist(null)).toBe('');
  });
});

// El criterio vive dos veces (logic.js y la función SQL que llenó la columna). Este test evita que se desfasen.
describe('docs/diccionario-mecanico.md', () => {
  it('está al día con logic.js (regenerar con node scripts/generar_diccionario_mecanico.js)', () => {
    const doc = readFileSync(new URL('../docs/diccionario-mecanico.md', import.meta.url), 'utf8');
    expect(doc).toBe(generarDiccionario());
  });
});

describe('la migración SQL sale de logic.js', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261108130000_sinonimos_historico_ot.sql', import.meta.url), 'utf8');
  it('componente_de_texto, sistema_de_texto_hist y clasificar_ot son exactamente lo que genera scripts/generar_componente_sql.js', () => {
    expect(sql).toContain(funcionSQL());
    expect(sql).toContain(funcionSistemaSQL());
    expect(sql).toContain(funcionClasificarSQL());
  });
});

describe('vocabulario del histórico, segunda pasada (2026-11-07)', () => {
  const casos = [
    ['tensado de orruga', 'Tren de Rodaje'],
    ['Se reponen tuercas de abrazaderas en baston de sistema komtrax', 'GPS/Telemetría/Router'],
    ['Se realiza reparación de sistema hombre ausente', 'Hombre Ausente'],
    ['Solucion radio de comunicación', 'Radio/Comunicaciones'],
    ['Se realiza carga de suspinsiones traseras', 'Suspensión'],
    ['Se reaprietan pernos de base de cilindro de desplazamiento vertedera', 'Pala (Motoniveladora)'],
    ['Se realiza verificación de falla en cilindro n°2 banco izquierdo', 'Motor'],
    ['Se reemplaza llave de paso de agua de red de incendio.', 'Sistema AFEX (Extinción de Incendios)'],
  ];
  casos.forEach(([t, e]) => it(t, () => expect(sistemaDeTextoHist(t)).toBe(e)));
  it('fuera de servicio por PM es preventiva, no falla; una falla con PM aparte sigue siendo falla', () => {
    expect(claseOTDesdeTexto('CAEX 56 fuera de servicio por PM')).toBe('preventiva');
    expect(claseOTDesdeTexto('Mantenimiento pm2/fuera de servicio por baja presion de posicion 6')).toBe('correctiva');
  });
  it('un mensaje de cotización no es una OT', () => {
    expect(claseOTDesdeTexto('Te escribo para solicitar tu visto bueno a la cotización número 102182991')).toBe('operacional');
  });
});

describe('sinónimos y errores de tipeo del histórico, tercera pasada (2026-11-08)', () => {
  const casos = [
    ['Equipo F/S por sonido anómalo en la trasnmisión. Queda operativo.', 'Transmisión'],
    ['BD-509 fuera de servicio sistema de engrace automático', 'Engrase/Lubricación'],
    ['cambio de pernos en posicion trasera', 'Pernos de Rueda'],
    ['reposición perno posición 4', 'Pernos de Rueda'],
    ['CE-86 fuera de servicio por perno cortado, equipo en parqueo general', 'Pernos de Rueda'],
    ['se realiza chequeo visual pos 6', 'Neumáticos'],
    ['Cambio de calzas', 'Elemento de Desgaste'],
    ['Se cambia cantonera izq por desgaste y quebrada', 'Elemento de Desgaste'],
    ['Se fabrica porta calzas', 'Balde/Implemento'],
    ['se realiza instalacion sistema manos libres', 'Radio/Comunicaciones'],
    ['Se realiza desmontaje de valvula EPC alevación como prestamo', 'Sistema Hidráulico'],
    ['se calibra potencimetro', 'Sistema Eléctrico'],
    ['Reemplazo sensor potenciometro', 'Sistema Eléctrico'],
    ['Se reapara sistema Mems4, se detecta splitter en mal estado', 'MEMS (Monitoreo de Neumáticos)'],
  ];
  casos.forEach(([t, e]) => it(t, () => expect(sistemaDeTextoHist(t)).toBe(e)));
  it('lo que no dice nada concreto sigue sin sistema: no se inventa', () => {
    ['Equipo fuera de servicio.', 'F/S', 'Equipo en taller.', 'Equipo F/S por sonido anómalo.', 'regulacion de presiones', 'BD-533 fuera de servicio por pernos sueltos', 'CHEQUEO BOMBA']
      .forEach((t) => expect(sistemaDeTextoHist(t)).toBe(''));
  });
});
