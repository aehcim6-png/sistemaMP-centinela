-- Sinónimos y errores de tipeo del histórico de OT (2026-11-08). Salió de leer las 87 OT que seguían sin sistema:
-- «trasnmisión», «engrace», calzas y cantoneras (piezas de desgaste), pernos de posición (rueda), manos libres (radio),
-- válvula EPC (hidráulico), potenciómetro (eléctrico), MEMS4 y splitter (monitoreo de neumáticos).
-- Criterios del usuario: «chequeo de bomba» = hidráulico, «chequeo/regulación de presiones» = neumático, «tope de tren trasero» = transmisión;
-- «ruido anormal» y «olor a quemado» apuntan a un grupo de sistemas y se guardan con ese nombre.
-- Las tres funciones son exactamente lo que genera scripts/generar_componente_sql.js desde logic.js.
create or replace function public.componente_de_texto(txt text)
returns text language sql immutable set search_path = pg_catalog, public as $$
  with x as (select lower(coalesce(txt,'')) t)
  select case
    when position('asiento' in t)>0 then 'Asiento'
    when position('bateria' in t)>0 or position('batería' in t)>0 or position('baterias' in t)>0 or position('baterías' in t)>0 then 'Batería'
    when position('motor de partida' in t)>0 or position('motor partida' in t)>0 or position('arranque' in t)>0 then 'Motor de Partida'
    when position('cilindro direccion' in t)>0 or position('cilindro de direccion' in t)>0 or position('cilindro dirección' in t)>0 or position('cilindro de dirección' in t)>0 or position('cilindro volante' in t)>0 or position('orbitrol' in t)>0 then 'Cilindro de Dirección'
    when position('neumatico' in t)>0 or position('neumático' in t)>0 or position('neumaticos' in t)>0 or position('neumáticos' in t)>0 or position('despresuriz' in t)>0 or position('desprezuriz' in t)>0 or position('presuriz' in t)>0 or position('posicion 1 baja presion' in t)>0 or position('posicion 3 baja presion' in t)>0 or position('check  point' in t)>0 or position('check point' in t)>0 then 'Neumáticos'
    when position('freno' in t)>0 then 'Frenos'
    when position('transmision' in t)>0 or position('transmisión' in t)>0 or position('kick dawn' in t)>0 or position('pick dawn' in t)>0 then 'Transmisión'
    when position('diferencial' in t)>0 or position('diferecial' in t)>0 then 'Diferencial'
    when position('mandos finales' in t)>0 or position('mando final' in t)>0 then 'Mandos Finales'
    when position('turbo' in t)>0 then 'Turbo'
    when position('alternador' in t)>0 then 'Alternador'
    when position('correa' in t)>0 then 'Correas'
    when position('bomba de agua' in t)>0 or position('bomba agua' in t)>0 then 'Bomba de Agua'
    when position('radiador' in t)>0 or position('refrigerante' in t)>0 or position('enfriador' in t)>0 or position('enfriadores' in t)>0 or position('refrigeracion' in t)>0 or position('viscoso' in t)>0 then 'Radiador/Enfriamiento'
    when position('suspension' in t)>0 or position('suspensión' in t)>0 or position('suspencion' in t)>0 then 'Suspensión'
    when position('inyector' in t)>0 or position('inyectores' in t)>0 then 'Inyectores'
    when position('filtro de combustible' in t)>0 or position('filtro combustible' in t)>0 or position('filtro decombustible' in t)>0 or position('filtros de combustible' in t)>0 or position('filtros combustible' in t)>0 then 'Filtro de Combustible'
    when position('filtro de aire' in t)>0 or position('filtro aire' in t)>0 or position('filtro de cabina' in t)>0 or position('filtro cabina' in t)>0 then 'Filtro de Aire'
    when position('bomba de combustible' in t)>0 or position('bomba combustible' in t)>0 or position('bomba inyectora' in t)>0 or position('bomba de inyeccion' in t)>0 or position('bomba inyeccion' in t)>0 then 'Bomba de Combustible'
    when position('cruceta' in t)>0 or position('crucetas' in t)>0 or position('cardan' in t)>0 or position('cardán' in t)>0 then 'Crucetas/Cardán'
    when position('soporte de cabina' in t)>0 or position('soporte cabina' in t)>0 or position('soportes de cabina' in t)>0 then 'Soporte de Cabina'
    when position('conector' in t)>0 or position('conectores' in t)>0 or position('arnes' in t)>0 or position('arnés' in t)>0 then 'Conectores/Cableado'
    when position('manguera' in t)>0 or position('mangueras' in t)>0 or position('flexible' in t)>0 or position('cañeria' in t)>0 or position('cañería' in t)>0 or position('caneria' in t)>0 then 'Mangueras/Fugas'
    when position('elemento de desgaste' in t)>0 or position('elementos de desgaste' in t)>0 or position('elementos desgaste' in t)>0 then 'Elemento de Desgaste'
    when position('ampolleta' in t)>0 or position('ampoleta' in t)>0 or position('alpolleta' in t)>0 or position('amplolleta' in t)>0 or position('foco delantero' in t)>0 or position('foco trasero' in t)>0 or position('foco frontal' in t)>0 or position('foco faenero' in t)>0 or position('focos faeneros' in t)>0 or position('faenero' in t)>0 or position('luz baja' in t)>0 or position('luz alta' in t)>0 or position('foco' in t)>0 or position('focos' in t)>0 or position('luces' in t)>0 then 'Foco/Ampolleta'
    when position('hidraulico' in t)>0 or position('hidráulico' in t)>0 then 'Sistema Hidráulico'
    when position('electrico' in t)>0 or position('eléctrico' in t)>0 or position('elÃ©ctrico' in t)>0 or position('eléctrica' in t)>0 or position('electrica' in t)>0 or position('bocina' in t)>0 or position('conversor' in t)>0 then 'Sistema Eléctrico'
    when position('aire acondicionado' in t)>0 or position(' a/c ' in t)>0 or position('a/c.' in t)>0 or position('condensador' in t)>0 or position('se carga ac' in t)>0 or position('chequeo a/c' in t)>0 or position('bajo flujo de a/c' in t)>0 or position('sistema de ac' in t)>0 or position('calefaccion' in t)>0 then 'Aire Acondicionado'
    when position('cuchilla' in t)>0 or position('cuchillo' in t)>0 or position('cuchillos' in t)>0 or position('entrediente' in t)>0 or position('gets' in t)>0 or position('entrecalza' in t)>0 or position('entrecalzas' in t)>0 or position('ripper' in t)>0 or position('riper' in t)>0 or position('canillera' in t)>0 or position('canilleras' in t)>0 then 'GET / Cuchillas'
    when position('pasador del balde' in t)>0 or position('pasador de balde' in t)>0 or position('pasador balde' in t)>0 or position('cambio de balde' in t)>0 or position('desgaste del balde' in t)>0 or position('balde nuevo' in t)>0 or position('balde por rotura' in t)>0 then 'Balde/Implemento'
    when position('biela' in t)>0 or position('pantografo' in t)>0 or position('pantógrafo' in t)>0 then 'Biela/Pantógrafo'
    when position('oruga' in t)>0 or position('cadena' in t)>0 or position('sprocket' in t)>0 or position('sproket' in t)>0 or position('zapata' in t)>0 or position('rodillo' in t)>0 or position('rueda tensora' in t)>0 or position('rueda motriz' in t)>0 or position('garra maestar' in t)>0 or position('garra maestra' in t)>0 then 'Tren de Rodaje'
    when position('engrase' in t)>0 or position('relleno de grasa' in t)>0 or position('carga de grasa' in t)>0 or position('tk de grasa' in t)>0 or position('tk grasa' in t)>0 or position('nivel de grasa' in t)>0 or position('nivel grasa' in t)>0 then 'Engrase/Lubricación'
    when position('fuga de aceite' in t)>0 or position('fuga aceite' in t)>0 then 'Fuga de Aceite'
    when position('radio base' in t)>0 or position('falla ptt' in t)>0 or position('antena' in t)>0 or position('ptt' in t)>0 then 'Radio/Comunicaciones'
    when position('somnolencia' in t)>0 or position('anticolision' in t)>0 or position('anticolisión' in t)>0 or position('anticolicion' in t)>0 or position('f&s' in t)>0 then 'Sistema Anticolisión/Fatiga (ADAS)'
    when position('tornamesa' in t)>0 or position('torna mesa' in t)>0 then 'Tornamesa/Giro'
    when position('joystick' in t)>0 or position('joytick' in t)>0 or position('joitick' in t)>0 then 'Joystick/Palanca de Mando'
    when position('parabrisas' in t)>0 then 'Parabrisas/Vidrios'
    when position('tolva' in t)>0 then 'Tolva/Dumper'
    when position('puerta' in t)>0 then 'Puertas'
    when position('espejo' in t)>0 then 'Espejos'
    when position('baliza' in t)>0 or position('pertiga' in t)>0 or position('pertica' in t)>0 then 'Baliza/Pértiga (Señalización)'
    when position('camara de retroceso' in t)>0 or position('camara retroceso' in t)>0 then 'Cámara de Retroceso'
    when position('afex' in t)>0 then 'Sistema AFEX (Extinción de Incendios)'
    when position('estanque combustible' in t)>0 or position('estanque de combustible' in t)>0 or position('tapa combustible' in t)>0 or position('tapa de combustible' in t)>0 or position('tapa de llenado de combustible' in t)>0 then 'Estanque/Tapa de Combustible'
    when t ~* '\ypala\y' then 'Pala (Motoniveladora)'
    when position('motor' in t)>0 or position('reel' in t)>0 then 'Motor'
    else null end from x;
$$;

create or replace function public.sistema_de_texto_hist(txt text)
returns text language sql immutable set search_path = pg_catalog, public as $$
  with x as (select lower(coalesce(txt,'')) t)
  select coalesce(
    case
    when position('empantan' in t)>0 or position('enterrad' in t)>0 or position('desenterr' in t)>0 or position('remolque' in t)>0 or position('siniestr' in t)>0 or position('falta combustible' in t)>0 or position('falta de combustible' in t)>0 or position('sin combustible' in t)>0 or position('autonomia' in t)>0 or position('autonomía' in t)>0 or position('turno noche' in t)>0 or position('sistema siga' in t)>0 or position('helipuer' in t)>0 or position('revision tecnica' in t)>0 or position('revisión técnica' in t)>0 or position('acreditaci' in t)>0 or position('cotizaci' in t)>0 then 'Operacional / Externo (no mecánico)'
    else null end,
    public.componente_de_texto(txt),
    case
    when position('rodado' in t)>0 or position('rodados' in t)>0 or position('segmento' in t)>0 or position('orruga' in t)>0 then 'Tren de Rodaje'
    when position('perno de rueda' in t)>0 or position('pernos de rueda' in t)>0 or position('perno cortado de rueda' in t)>0 or position('pernos cortados de rueda' in t)>0 or position('pernos cortados' in t)>0 or position('perno cortado' in t)>0 or position('tuerca interior' in t)>0 or position('falta tuerca' in t)>0 or t ~* 'tuerca.{0,12}posici[oó]n' or t ~* 'pernos?.{0,25}posici[oó]n' or t ~* 'pernos?.{0,25}\ypos\.? ?\d' then 'Pernos de Rueda'
    when position('neuamtic' in t)>0 or position('nemátic' in t)>0 or position('nematic' in t)>0 or position('nuemátic' in t)>0 or position('nuematic' in t)>0 or position('prezuriz' in t)>0 or position('checkpoint' in t)>0 or position('remanente' in t)>0 or position('banda lateral' in t)>0 or position('protuberancia' in t)>0 or t ~* 'presi[oó]n.{0,25}posici[oó]n' or t ~* 'posici[oó]n.{0,25}presi[oó]n' or t ~* 'aire.{0,15}posici[oó]n' or t ~* 'chequeo visual.{0,12}\ypos' or t ~* '(chequeo|regulaci[oó]n|revisi[oó]n|ajuste)s? (de )?presi[oó]n(es)?(?! (de )?(aceite|combustible|hidr|aire acond|compresor|frenos?))' then 'Neumáticos'
    when position('afx' in t)>0 or position('contra incendio' in t)>0 or position('contraincendio' in t)>0 or position('red de incendio' in t)>0 then 'Sistema AFEX (Extinción de Incendios)'
    when position('retardador' in t)>0 or position('retardo' in t)>0 then 'Retardador'
    when position('direccion' in t)>0 or position('dirección' in t)>0 or position('varillaje' in t)>0 or position('fuelle' in t)>0 or position('volante' in t)>0 then 'Sistema de Dirección'
    when position('aspersor' in t)>0 or position('regadio' in t)>0 or position('regadío' in t)>0 or position('membrana' in t)>0 or position('bomba centrifuga' in t)>0 or position('bomba centrífuga' in t)>0 or position('toma fuerza' in t)>0 or position('toma de fuerza' in t)>0 or position('fuga de agua' in t)>0 or position('estanque de agua' in t)>0 or position('llave de paso de agua' in t)>0 then 'Regadío/Aspersores'
    when position('cinturon' in t)>0 or position('cinturón' in t)>0 then 'Cinturón de Seguridad'
    when position('emergencia' in t)>0 then 'Sistema de Emergencia'
    when t ~* '\yplm\y' then 'PLM (Medidor de Carga)'
    when t ~* '\ymems' or position('transceptor' in t)>0 or position('transeptor' in t)>0 or position('splitter' in t)>0 then 'MEMS (Monitoreo de Neumáticos)'
    when t ~* '\ygps\y' or position('router' in t)>0 or position('bastones' in t)>0 or position('bastón' in t)>0 or position('komtrax' in t)>0 then 'GPS/Telemetría/Router'
    when position('radar' in t)>0 or position('proximidad' in t)>0 or position('semnolencia' in t)>0 or position('sonlenencia' in t)>0 or position('somnolenc' in t)>0 or t ~* '\yf y s\y' then 'Sistema Anticolisión/Fatiga (ADAS)'
    when position('alarma de retroceso' in t)>0 or position('camara de retorceso' in t)>0 or position('cámara de retroceso' in t)>0 or position('retroceso' in t)>0 then 'Cámara de Retroceso'
    when position('a/c' in t)>0 or position('problema de ac' in t)>0 or position('problema ac' in t)>0 or position('evaporador' in t)>0 or position('blower' in t)>0 or position('sistema ac' in t)>0 or position('calefacción' in t)>0 then 'Aire Acondicionado'
    when position('acumulador' in t)>0 or position('nitrogeno' in t)>0 or position('nitrógeno' in t)>0 then 'Acumuladores/Nitrógeno'
    when position('compresor' in t)>0 or position('fuga de aire' in t)>0 or position('perdida de aire' in t)>0 or position('pérdida de aire' in t)>0 then 'Sistema de Aire/Compresor'
    when position('adblue' in t)>0 or position('ad blue' in t)>0 or position('ad-blue' in t)>0 or position('ab-blue' in t)>0 or position('ab blue' in t)>0 or position('ablue' in t)>0 then 'AdBlue/SCR'
    when position('combustible' in t)>0 or t ~* '\yriel\y' or position('petróleo' in t)>0 or position('petroleo' in t)>0 then 'Sistema de Combustible'
    when position('escape' in t)>0 then 'Sistema de Escape'
    when position('intercooler' in t)>0 or position('interooler' in t)>0 or position('intercoller' in t)>0 or position('electroventilador' in t)>0 or position('ventilador' in t)>0 or t ~* '\yfan\y' then 'Radiador/Enfriamiento'
    when position('corona' in t)>0 or position('peñon' in t)>0 or position('peñón' in t)>0 then 'Diferencial'
    when position('embrague' in t)>0 or position('caja de cambios' in t)>0 or position('visor de marchas' in t)>0 or position('no pasa marchas' in t)>0 or position('marchas' in t)>0 or position('trasnmis' in t)>0 or position('trasmisi' in t)>0 or position('transmicion' in t)>0 then 'Transmisión'
    when position('comando' in t)>0 then 'Joystick/Palanca de Mando'
    when position('hidraulica' in t)>0 or position('hidráulica' in t)>0 or position('hidrulico' in t)>0 or position('hidraulicas' in t)>0 or t ~* 'v[aá]lvula epc' then 'Sistema Hidráulico'
    when position('engrace' in t)>0 or position('engrase automatico' in t)>0 or position('engrase automático' in t)>0 or position('pre lub' in t)>0 or position('prelub' in t)>0 or position('deposito de grasa' in t)>0 or position('depósito de grasa' in t)>0 or position('tanque de grasa' in t)>0 or position('lubricacion' in t)>0 or position('lubricación' in t)>0 or position('grasa' in t)>0 then 'Engrase/Lubricación'
    when position('reaper' in t)>0 or position('ripeer' in t)>0 or position('punta' in t)>0 or position('puntas' in t)>0 then 'GET / Cuchillas'
    when position('plancha de desgaste' in t)>0 or position('planchas de desgaste' in t)>0 then 'Elemento de Desgaste'
    when position('balde' in t)>0 or position('implemento' in t)>0 or position('dozer' in t)>0 or position('tilt' in t)>0 or position('pasador' in t)>0 or position('shank' in t)>0 or position('portacuña' in t)>0 or position('porta cuña' in t)>0 or position('porta cuñas' in t)>0 or position('portacuñas' in t)>0 or position('desfondado' in t)>0 or position('porta calza' in t)>0 or position('portacalza' in t)>0 or position('porta calzas' in t)>0 then 'Balde/Implemento'
    when position('calza' in t)>0 or position('cantonera' in t)>0 then 'Elemento de Desgaste'
    when position('soldadura' in t)>0 or position('fabricacion' in t)>0 or position('fabricación' in t)>0 or position('fabrica' in t)>0 or position('baranda' in t)>0 or position('escalera' in t)>0 or position('parachoque' in t)>0 or position('guardafango' in t)>0 or position('tapabarro' in t)>0 or position('estructura' in t)>0 or position('estructural' in t)>0 or position('reforz' in t)>0 or position('blindaje' in t)>0 or position('codera' in t)>0 or position('plancha' in t)>0 or position('soporte' in t)>0 or position('proteccion' in t)>0 or position('protección' in t)>0 or position('tapa barro' in t)>0 then 'Estructura/Soldadura'
    when position('cabina' in t)>0 or position('parasol' in t)>0 or position('visera' in t)>0 or position('vicera' in t)>0 or position('gases' in t)>0 or position('sellado' in t)>0 or position('letrero' in t)>0 or position('hermet' in t)>0 or position('hermit' in t)>0 then 'Cabina/Carrocería'
    when position('radio de comunic' in t)>0 or position('radio musical' in t)>0 or position('radio' in t)>0 or position('manos libres' in t)>0 then 'Radio/Comunicaciones'
    when position('suspins' in t)>0 or position('suspención' in t)>0 or position('suspenci' in t)>0 or position('estabilizador' in t)>0 or position('resorte' in t)>0 then 'Suspensión'
    when position('oring' in t)>0 or position('o-ring' in t)>0 or position('o ring' in t)>0 then 'Sellos/O-rings'
    when position('parabrisa' in t)>0 or position('vidrio' in t)>0 then 'Parabrisas/Vidrios'
    when position('siento' in t)>0 or position('apoya brazo' in t)>0 or position('apoyabrazo' in t)>0 or position('apoya brazos' in t)>0 then 'Asiento'
    when position('luz de trocha' in t)>0 or position('iluminaria' in t)>0 then 'Foco/Ampolleta'
    when position('pértiga' in t)>0 then 'Baliza/Pértiga (Señalización)'
    when position('hombre ausente' in t)>0 then 'Hombre Ausente'
    when t ~* 'cilindro n?°? ?\d.{0,20}banco' or position('banco izquierdo' in t)>0 or position('banco derecho' in t)>0 then 'Motor'
    when position('potenciometro' in t)>0 or position('potenciómetro' in t)>0 or position('potencimetro' in t)>0 or position('fusible' in t)>0 or position('no enciende' in t)>0 or position('sin partida' in t)>0 or position('problema de partida' in t)>0 or position('chapa de encendido' in t)>0 or position('partida' in t)>0 or position('puesta en marcha' in t)>0 or position('codigo' in t)>0 or position('código' in t)>0 or position('alerta nivel' in t)>0 or position('alarma 3' in t)>0 or t ~* '\ye-?0[1-9]\y' then 'Sistema Eléctrico'
    when position('motoniveladora' in t)>0 or position('vertedera' in t)>0 then 'Pala (Motoniveladora)'
    when t ~* '\ybombas?\y' then 'Sistema Hidráulico'
    when position('tren trasero' in t)>0 then 'Transmisión'
    else null end,
    case
    when position('ruido anormal' in t)>0 or position('ruido anomalo' in t)>0 or position('ruido anómalo' in t)>0 or position('sonido anormal' in t)>0 or position('sonido anomalo' in t)>0 or position('sonido anómalo' in t)>0 or position('ruido extraño' in t)>0 or position('ruido extrano' in t)>0 then 'Ruido anormal (motor, diferencial o transmisión)'
    when position('olor a quemado' in t)>0 or position('olor quemado' in t)>0 or position('olor a quemad' in t)>0 then 'Olor a quemado (aceite de motor, hidráulico o transmisión)'
    when position('perdida de potencia' in t)>0 or position('pérdida de potencia' in t)>0 or position('baja potencia' in t)>0 or position('falta de potencia' in t)>0 or position('exceso de humo' in t)>0 or position('alza de temperatura' in t)>0 then 'Pérdida de Potencia (causa no indicada)'
    when t ~* '\ypm ?0?[1-4]\y' or position('mantencion preventiva' in t)>0 or position('mantención preventiva' in t)>0 or position('mantencion prreventiva' in t)>0 or position('mantencion programada' in t)>0 or position('mantención programada' in t)>0 or position('mp pm' in t)>0 or position('mantenimiento preventivo' in t)>0 or position('mantencicion' in t)>0 or position('por pm' in t)>0 or position('chequeo semanal' in t)>0 or position('inspeccion diaria' in t)>0 or position('inspección diaria' in t)>0 or position('mantencion en terreno' in t)>0 or position('mantención en terreno' in t)>0 then 'Mantención Preventiva/PM'
    else null end
  ) from x;
$$;

create or replace function public.clasificar_ot(descripcion text, tipo_int text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when tipo_int in ('Programada', 'Predictiva') then 'preventiva'
    when coalesce(descripcion, '') ~* '(empantan|enterrad|desenterr|remolque|siniestr|falta (de )?combustible|sin combustible|autonom[ií]a|turno noche|sistema siga|helipuer|revisi[oó]n t[eé]cnica|acreditaci|cotizaci[oó]n)' then 'operacional'
    when coalesce(descripcion, '') ~* '(fuera de servicio|f\/s)[^.]{0,30}(por pm|\ypm ?0?[1-4]\y|mantenci[oó]n programada|mantencicion programada|mantenimiento preventivo)' then 'preventiva'
    when coalesce(descripcion, '') ~* '(instala|instalaci[oó]n|mejora|calibra|polariz|sellado de cabina|hermeticidad)'
     and coalesce(descripcion, '') ~* '(radio base|antisomnolen|somnolencia|fatiga|\yadas\y|polariz|check ?point|c[aá]mara|manos libres|gps|sellado de cabina|hermeticidad)'
     and coalesce(descripcion, '') !~* '(fuera de servicio|falla|fuga|corte|da[ñn]ad|defectuos|repara)'
      then 'instalacion'
    when coalesce(descripcion, '') ~* '(rodado|cuchilla|elementos? de desgaste|entre ?calza|entre ?diente|calzas|puntas? (del )?ripper|cantonera|reposici[oó]n de elemento|pernos? de elemento)' then 'desgaste'
    when coalesce(descripcion, '') ~* '(adblue|ad.blue|ab.blue|ablue|mantenimiento (preventivo|programado)|sopleteo|chequeo de niveles|chequeo visual|inp?ecci[oó]n visual|inspecci[oó]n visual|prueba de herm|rellena con petr[oó]leo|calibraci[oó]n|\ypm ?0?[1-4]\y|mantenci[oó]n prreventiva|mantenci[oó]n en terreno|chequeo semanal|inspecci[oó]n (diaria|general)|control (de )?neum|chequeo (de )?neum|presuri|inflado|torque|apernadura|retorque|normaliza pos|chequeo preventivo|mantenci[oó]n preventiva|mantenci[oó]n (semanal|diaria|programada)|chequeo diario|chequeo general|engrase|relleno (de|en) (dep[oó]sito|tanque|tk)|relleno de (grasa|aceite|refrigerante|niveles)|revisi[oó]n de niveles|limpieza (de )?filtro|sopletea|lavado)'
     and coalesce(descripcion, '') !~* '(fuera de servicio|falla|fuga|rota|roto|cambio de (motor|turbo|compresor|bomba|cilindro)|c[oó]digo)'
      then 'preventiva'
    else 'correctiva'
  end;
$$;

revoke all on function public.componente_de_texto(text) from public, anon, authenticated;
grant execute on function public.componente_de_texto(text) to service_role;
revoke all on function public.sistema_de_texto_hist(text) from public, anon, authenticated;
grant execute on function public.sistema_de_texto_hist(text) to service_role;
revoke all on function public.clasificar_ot(text, text) from public, anon, authenticated;
grant execute on function public.clasificar_ot(text, text) to service_role;

-- Rellena el sistema solo donde sigue vacío y el texto ahora sí lo dice (no toca lo que ya tenía sistema).
update public.correctivos_historico
   set sistema = public.sistema_de_texto_hist(descripcion)
 where (sistema is null or btrim(sistema) = '' or lower(btrim(sistema)) = 'general')
   and public.sistema_de_texto_hist(descripcion) is not null;
