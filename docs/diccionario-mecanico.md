# Diccionario mecánico de las órdenes de trabajo

Qué palabra del texto de una OT lleva a qué sistema o componente. Se aplica en este orden y gana la primera coincidencia. Generado por `scripts/generar_diccionario_mecanico.js` desde `logic.js`: no se edita a mano.

### 1. Operacional (se mira primero)

Eventos que no son una falla mecánica: la OT queda con clase `operacional` y no cuenta como falla.

| Sistema / componente | Palabras que lo identifican |
|---|---|
| Operacional / Externo (no mecánico) | `empantan`, `enterrad`, `desenterr`, `remolque`, `siniestr`, `falta combustible`, `falta de combustible`, `sin combustible`, `autonomia`, `autonomía`, `turno noche`, `sistema siga`, `helipuer`, `revision tecnica`, `revisión técnica`, `acreditaci`, `cotizaci` |

### 2. Componentes de la app

El diccionario que usa la app para las OT en vivo (copias exactas en las Edge Functions de WhatsApp y alertas).

| Sistema / componente | Palabras que lo identifican |
|---|---|
| Asiento | `asiento` |
| Batería | `bateria`, `batería`, `baterias`, `baterías` |
| Motor de Partida | `motor de partida`, `motor partida`, `arranque` |
| Cilindro de Dirección | `cilindro direccion`, `cilindro de direccion`, `cilindro dirección`, `cilindro de dirección`, `cilindro volante`, `orbitrol` |
| Neumáticos | `neumatico`, `neumático`, `neumaticos`, `neumáticos`, `despresuriz`, `desprezuriz`, `presuriz`, `posicion 1 baja presion`, `posicion 3 baja presion`, `check  point`, `check point` |
| Frenos | `freno` |
| Transmisión | `transmision`, `transmisión`, `kick dawn`, `pick dawn` |
| Diferencial | `diferencial`, `diferecial` |
| Mandos Finales | `mandos finales`, `mando final` |
| Turbo | `turbo` |
| Alternador | `alternador` |
| Correas | `correa` |
| Bomba de Agua | `bomba de agua`, `bomba agua` |
| Radiador/Enfriamiento | `radiador`, `refrigerante`, `enfriador`, `enfriadores`, `refrigeracion`, `viscoso` |
| Suspensión | `suspension`, `suspensión`, `suspencion` |
| Inyectores | `inyector`, `inyectores` |
| Filtro de Combustible | `filtro de combustible`, `filtro combustible`, `filtro decombustible`, `filtros de combustible`, `filtros combustible` |
| Filtro de Aire | `filtro de aire`, `filtro aire`, `filtro de cabina`, `filtro cabina` |
| Bomba de Combustible | `bomba de combustible`, `bomba combustible`, `bomba inyectora`, `bomba de inyeccion`, `bomba inyeccion` |
| Crucetas/Cardán | `cruceta`, `crucetas`, `cardan`, `cardán` |
| Soporte de Cabina | `soporte de cabina`, `soporte cabina`, `soportes de cabina` |
| Conectores/Cableado | `conector`, `conectores`, `arnes`, `arnés` |
| Mangueras/Fugas | `manguera`, `mangueras`, `flexible`, `cañeria`, `cañería`, `caneria` |
| Elemento de Desgaste | `elemento de desgaste`, `elementos de desgaste`, `elementos desgaste` |
| Foco/Ampolleta | `ampolleta`, `ampoleta`, `alpolleta`, `amplolleta`, `foco delantero`, `foco trasero`, `foco frontal`, `foco faenero`, `focos faeneros`, `faenero`, `luz baja`, `luz alta`, `foco`, `focos`, `luces` |
| Sistema Hidráulico | `hidraulico`, `hidráulico` |
| Sistema Eléctrico | `electrico`, `eléctrico`, `elÃ©ctrico`, `eléctrica`, `electrica`, `bocina`, `conversor` |
| Aire Acondicionado | `aire acondicionado`, ` a/c `, `a/c.`, `condensador`, `se carga ac`, `chequeo a/c`, `bajo flujo de a/c`, `sistema de ac`, `calefaccion` |
| GET / Cuchillas | `cuchilla`, `cuchillo`, `cuchillos`, `entrediente`, `gets`, `entrecalza`, `entrecalzas`, `ripper`, `riper`, `canillera`, `canilleras` |
| Balde/Implemento | `pasador del balde`, `pasador de balde`, `pasador balde`, `cambio de balde`, `desgaste del balde`, `balde nuevo`, `balde por rotura` |
| Biela/Pantógrafo | `biela`, `pantografo`, `pantógrafo` |
| Tren de Rodaje | `oruga`, `cadena`, `sprocket`, `sproket`, `zapata`, `rodillo`, `rueda tensora`, `rueda motriz`, `garra maestar`, `garra maestra` |
| Engrase/Lubricación | `engrase`, `relleno de grasa`, `carga de grasa`, `tk de grasa`, `tk grasa`, `nivel de grasa`, `nivel grasa` |
| Fuga de Aceite | `fuga de aceite`, `fuga aceite` |
| Radio/Comunicaciones | `radio base`, `falla ptt`, `antena`, `ptt` |
| Sistema Anticolisión/Fatiga (ADAS) | `somnolencia`, `anticolision`, `anticolisión`, `anticolicion`, `f&s` |
| Tornamesa/Giro | `tornamesa`, `torna mesa` |
| Joystick/Palanca de Mando | `joystick`, `joytick`, `joitick` |
| Parabrisas/Vidrios | `parabrisas` |
| Tolva/Dumper | `tolva` |
| Puertas | `puerta` |
| Espejos | `espejo` |
| Baliza/Pértiga (Señalización) | `baliza`, `pertiga`, `pertica` |
| Cámara de Retroceso | `camara de retroceso`, `camara retroceso` |
| Sistema AFEX (Extinción de Incendios) | `afex` |
| Estanque/Tapa de Combustible | `estanque combustible`, `estanque de combustible`, `tapa combustible`, `tapa de combustible`, `tapa de llenado de combustible` |
| Pala (Motoniveladora) | `/\bpala\b/` |
| Motor | `motor`, `reel` |

### 3. Extensión para el histórico

Vocabulario de la planta sacado de leer las OT de Disponibilidad Mecánica y del Excel. «Rodado» es el rodillo y tren de rodaje del bulldozer (elemento de desgaste); AFEX es el sistema contra incendio; «dar partida» y «código activo» son eléctricos.

| Sistema / componente | Palabras que lo identifican |
|---|---|
| Tren de Rodaje | `rodado`, `rodados`, `segmento`, `orruga` |
| Pernos de Rueda | `perno de rueda`, `pernos de rueda`, `perno cortado de rueda`, `pernos cortados de rueda`, `pernos cortados`, `perno cortado`, `tuerca interior`, `falta tuerca`, `/tuerca.{0,12}posici[oó]n/`, `/pernos?.{0,25}posici[oó]n/`, `/pernos?.{0,25}\bpos\.? ?\d/` |
| Neumáticos | `neuamtic`, `nemátic`, `nematic`, `nuemátic`, `nuematic`, `prezuriz`, `checkpoint`, `remanente`, `banda lateral`, `protuberancia`, `/presi[oó]n.{0,25}posici[oó]n/`, `/posici[oó]n.{0,25}presi[oó]n/`, `/aire.{0,15}posici[oó]n/`, `/chequeo visual.{0,12}\bpos/`, `/(chequeo|regulaci[oó]n|revisi[oó]n|ajuste)s? (de )?presi[oó]n(es)?(?! (de )?(aceite|combustible|hidr|aire acond|compresor|frenos?))/` |
| Sistema AFEX (Extinción de Incendios) | `afx`, `contra incendio`, `contraincendio`, `red de incendio` |
| Retardador | `retardador`, `retardo` |
| Sistema de Dirección | `direccion`, `dirección`, `varillaje`, `fuelle`, `volante` |
| Regadío/Aspersores | `aspersor`, `regadio`, `regadío`, `membrana`, `bomba centrifuga`, `bomba centrífuga`, `toma fuerza`, `toma de fuerza`, `fuga de agua`, `estanque de agua`, `llave de paso de agua` |
| Cinturón de Seguridad | `cinturon`, `cinturón` |
| Sistema de Emergencia | `emergencia` |
| PLM (Medidor de Carga) | `/\bplm\b/` |
| MEMS (Monitoreo de Neumáticos) | `/\bmems/`, `transceptor`, `transeptor`, `splitter` |
| GPS/Telemetría/Router | `/\bgps\b/`, `router`, `bastones`, `bastón`, `komtrax` |
| Sistema Anticolisión/Fatiga (ADAS) | `radar`, `proximidad`, `semnolencia`, `sonlenencia`, `somnolenc`, `/\bf y s\b/` |
| Cámara de Retroceso | `alarma de retroceso`, `camara de retorceso`, `cámara de retroceso`, `retroceso` |
| Aire Acondicionado | `a/c`, `problema de ac`, `problema ac`, `evaporador`, `blower`, `sistema ac`, `calefacción` |
| Acumuladores/Nitrógeno | `acumulador`, `nitrogeno`, `nitrógeno` |
| Sistema de Aire/Compresor | `compresor`, `fuga de aire`, `perdida de aire`, `pérdida de aire` |
| AdBlue/SCR | `adblue`, `ad blue`, `ad-blue`, `ab-blue`, `ab blue`, `ablue` |
| Sistema de Combustible | `combustible`, `/\briel\b/`, `petróleo`, `petroleo` |
| Sistema de Escape | `escape` |
| Radiador/Enfriamiento | `intercooler`, `interooler`, `intercoller`, `electroventilador`, `ventilador`, `/\bfan\b/` |
| Diferencial | `corona`, `peñon`, `peñón` |
| Transmisión | `embrague`, `caja de cambios`, `visor de marchas`, `no pasa marchas`, `marchas`, `trasnmis`, `trasmisi`, `transmicion` |
| Joystick/Palanca de Mando | `comando` |
| Sistema Hidráulico | `hidraulica`, `hidráulica`, `hidrulico`, `hidraulicas`, `/v[aá]lvula epc/` |
| Engrase/Lubricación | `engrace`, `engrase automatico`, `engrase automático`, `pre lub`, `prelub`, `deposito de grasa`, `depósito de grasa`, `tanque de grasa`, `lubricacion`, `lubricación`, `grasa` |
| GET / Cuchillas | `reaper`, `ripeer`, `punta`, `puntas` |
| Elemento de Desgaste | `plancha de desgaste`, `planchas de desgaste` |
| Balde/Implemento | `balde`, `implemento`, `dozer`, `tilt`, `pasador`, `shank`, `portacuña`, `porta cuña`, `porta cuñas`, `portacuñas`, `desfondado`, `porta calza`, `portacalza`, `porta calzas` |
| Elemento de Desgaste | `calza`, `cantonera` |
| Estructura/Soldadura | `soldadura`, `fabricacion`, `fabricación`, `fabrica`, `baranda`, `escalera`, `parachoque`, `guardafango`, `tapabarro`, `estructura`, `estructural`, `reforz`, `blindaje`, `codera`, `plancha`, `soporte`, `proteccion`, `protección`, `tapa barro` |
| Cabina/Carrocería | `cabina`, `parasol`, `visera`, `vicera`, `gases`, `sellado`, `letrero`, `hermet`, `hermit` |
| Radio/Comunicaciones | `radio de comunic`, `radio musical`, `radio`, `manos libres` |
| Suspensión | `suspins`, `suspención`, `suspenci`, `estabilizador`, `resorte` |
| Sellos/O-rings | `oring`, `o-ring`, `o ring` |
| Parabrisas/Vidrios | `parabrisa`, `vidrio` |
| Asiento | `siento`, `apoya brazo`, `apoyabrazo`, `apoya brazos` |
| Foco/Ampolleta | `luz de trocha`, `iluminaria` |
| Baliza/Pértiga (Señalización) | `pértiga` |
| Hombre Ausente | `hombre ausente` |
| Motor | `/cilindro n?°? ?\d.{0,20}banco/`, `banco izquierdo`, `banco derecho` |
| Sistema Eléctrico | `potenciometro`, `potenciómetro`, `potencimetro`, `fusible`, `no enciende`, `sin partida`, `problema de partida`, `chapa de encendido`, `partida`, `puesta en marcha`, `codigo`, `código`, `alerta nivel`, `alarma 3`, `/\be-?0[1-9]\b/` |
| Pala (Motoniveladora) | `motoniveladora`, `vertedera` |
| Sistema Hidráulico | `/\bbombas?\b/` |
| Transmisión | `tren trasero` |

### 4. Otros eventos

Si no hay componente, se anota el tipo de evento. Si el texto solo dice «fuera de servicio», el sistema queda vacío: no se inventa.

| Sistema / componente | Palabras que lo identifican |
|---|---|
| Ruido anormal (motor, diferencial o transmisión) | `ruido anormal`, `ruido anomalo`, `ruido anómalo`, `sonido anormal`, `sonido anomalo`, `sonido anómalo`, `ruido extraño`, `ruido extrano` |
| Olor a quemado (aceite de motor, hidráulico o transmisión) | `olor a quemado`, `olor quemado`, `olor a quemad` |
| Pérdida de Potencia (causa no indicada) | `perdida de potencia`, `pérdida de potencia`, `baja potencia`, `falta de potencia`, `exceso de humo`, `alza de temperatura` |
| Mantención Preventiva/PM | `/\bpm ?0?[1-4]\b/`, `mantencion preventiva`, `mantención preventiva`, `mantencion prreventiva`, `mantencion programada`, `mantención programada`, `mp pm`, `mantenimiento preventivo`, `mantencicion`, `por pm`, `chequeo semanal`, `inspeccion diaria`, `inspección diaria`, `mantencion en terreno`, `mantención en terreno` |
