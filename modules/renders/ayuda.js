// Pestaña Ayuda / Manual de Usuario — extraída a su propio archivo (Fase 2
// de modularización). Script plano (NO módulo ES), mismo scope global de
// siempre. Contenido 100% estático (sin funciones auxiliares propias) —
// solo usa imprimirTab(), compartida en index.html (botón global de la
// barra superior, usado por todas las pestañas).
window.renderAyuda=function(){
  var eq=S.g('eq')||[];
  var reg=S.g('reg')||[];
  var ot=S.g('ot')||[];
  $('s-ayuda').innerHTML=
    '<div class="sec-h"><div><div class="sec-t">📖 Manual de Usuario — SistemaMP Centinela</div>'+
    '<div class="sec-s">Guía completa de operación del sistema</div></div>'+
    '<button class="btn" onclick="imprimirTab(\'ayuda\',\'Manual de Usuario\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg> Imprimir Manual</button></div>'+

    // NOVEDADES DE ESTA VERSIÓN (agosto 2026)
    '<div class="card" style="margin-bottom:16px;border-left:3px solid #f59e0b;background:rgba(245,158,11,.05)">'+
    '<b style="font-size:15px">🆕 Novedades y correcciones recientes (agosto 2026)</b>'+
    '<p style="font-size:12px;color:var(--tx2);margin:10px 0">4 correcciones puntuales encontradas durante un reordenamiento interno del sistema (sin cambios de comportamiento salvo estos 4 puntos).</p>'+
    '<ul style="font-size:12px;line-height:1.8;margin:8px 0 12px 18px">'+
    '<li><b>Destrabe e Historial de Horómetros — el campo "Equipo" ya no se puede escribir mal:</b> antes era un texto libre; un typo hacía que ese registro desapareciera solo (sin aviso) en el siguiente refresco de pantalla. Ahora es un desplegable con los equipos reales — el error deja de ser posible.</li>'+
    '<li><b>Gestión de Destrabe ahora guarda TODOS sus datos en la nube:</b> antes solo el campo "Motivo" llegaba bien a Supabase; Equipo, Trabajo, Tipo, Fechas, Acción, Responsable y Estado se guardaban vacíos ahí (aunque sí quedaban bien en este navegador). Corregido — todo el registro se sincroniza completo.</li>'+
    '<li><b>Tooltip del Programa Anual ya no se rompe visualmente:</b> cuando el PM ejecutado no coincidía con el planificado, el aviso emergente de la celda mostraba código en vez del mensaje. Ahora se ve el aviso normal, en texto.</li>'+
    '<li><b>Botón "+ Agregar" de Componentes Mayores ya funciona:</b> antes creaba un componente sin equipo asignado, que el sistema borraba solo de inmediato — parecía que el botón no hacía nada. Ahora pide el equipo real antes de crear el componente.</li>'+
    '</ul>'+
    '</div>'+

    // NOVEDADES ANTERIORES (julio 2026)
    '<div class="card" style="margin-bottom:16px;border-left:3px solid #f59e0b;background:rgba(245,158,11,.05)">'+
    '<b style="font-size:15px">🆕 Novedades y correcciones recientes (julio 2026)</b>'+
    '<p style="font-size:12px;color:var(--tx2);margin:10px 0">Auditoría completa del sistema, pestaña por pestaña, buscando cálculos que muestran algo fácil de calcular en vez de lo que realmente importa. Tus datos siguen intactos; lo que cambió es que varios números ahora reflejan mejor la realidad.</p>'+
    '<ul style="font-size:12px;line-height:1.8;margin:8px 0 12px 18px">'+
    '<li><b>Neumáticos:</b> reglas de cambio ajustadas por marca y posición según lo confirmado en faena (delanteros vs traseros, Michelin/Bridgestone), y corregido el cálculo de horas acumuladas cuando un neumático pasa de un equipo a otro (antes sumaba mal la transferencia).</li>'+
    '<li><b>Un solo cálculo para Stock, Disponibilidad, Predictivo, KPI, Metas y Backlog:</b> antes cada pestaña calculaba estas cosas por su cuenta y podían mostrar números distintos para el mismo equipo/mes. Ahora todas usan la misma fuente, así que dejan de contradecirse entre sí.</li>'+
    '<li><b>Pautas de mantención reales cargadas:</b> se subieron las pautas oficiales 2026 por tipo de equipo (camiones, cargadores, bulldozers, motoniveladoras, torres, aljibe, bus, generador, minicargador), con el nivel de PM correcto para cada actividad.</li>'+
    '<li><b>Consumo de filtros y lubricantes reconciliado:</b> el catálogo de lubricantes tenía el mismo aceite escrito de 6 formas distintas (se unificó) y los filtros ahora se reconocen tanto por su número original como por el alternativo de otro proveedor — antes solo se buscaba uno de los dos.</li>'+
    '<li><b>Componentes Mayores ya no asume "recién instalado":</b> antes todo componente sin dato figuraba con ~0% de vida usada aunque el equipo tuviera 20.000+ horas. Ahora hay que marcar "Original" o ingresar la fecha de instalación (con estimador automático del horómetro a esa fecha) para que se calcule su vida real.</li>'+
    '<li><b>Fecha del próximo PM más precisa:</b> usa el ritmo real de horas de trabajo de cada equipo en vez de las horas/día nominales, que solían sobreestimar el uso y adelantar las alertas.</li>'+
    '<li><b>Salida de servicio "en curso":</b> ya se puede marcar un equipo como fuera de servicio sin saber aún la fecha de término, en vez de tener que inventar una — antes eso hacía que el equipo apareciera disponible al día siguiente aunque siguiera detenido.</li>'+
    '<li><b>Vencimientos documentales:</b> un documento que la normativa exige pero nunca se ha registrado (ej. Sistema AFEX) ahora se distingue de uno que simplemente no aplica a ese equipo, y sí cuenta como alerta — antes ambos se veían igual y quedaban invisibles.</li>'+
    '<li><b>Programación Diaria:</b> corregidas columnas "Cargo" repetidas que se importaban como si fueran bloques de horario, y la utilización de dotación ya no cuenta charla, colación ni vacaciones como trabajo productivo.</li>'+
    '<li><b>Programa Anual:</b> el tipo de PM proyectado para cada mes sigue el ciclo real del equipo, no una secuencia fija PM1→PM2→PM3→PM4.</li>'+
    '<li><b>Más rápido al ingresar:</b> las tablas grandes se cargan en paralelo en vez de una página a la vez — el arranque del sistema ya no se siente lento aunque los datos hayan crecido.</li>'+
    '<li><b>Próximo PM ya no ignora un PM recién hecho anticipado:</b> el calendario oficial de PM (cada 250/500/1.000/2.000h desde cero) se mantiene siempre fijo — hacer un PM un poco antes o después de su hito no corre el resto del calendario. Pero si se hace ANTES de llegar a su propio hito (ej. un PM4 hecho en la hora 1.977 en vez de 2.000), el sistema ya no vuelve a pedir ese mismo PM a las pocas horas — reconoce que ese hito ya quedó cubierto y pasa al siguiente.</li>'+
    '<li><b>Un PM con fecha retroactiva ya no hace retroceder el horómetro del equipo:</b> antes, registrar un PM con fecha anterior (algo que ocurrió hace semanas o meses y recién se anota) con su horómetro de esa fecha arrastraba hacia atrás el horómetro EN VIVO del equipo, aunque este ya hubiera avanzado bastante más desde entonces. Ahora ese dato se guarda en el historial, pero solo el registro más reciente cronológicamente actualiza el horómetro actual.</li>'+
    '<li><b>Editar el horómetro en Equipos ahora también alimenta el historial:</b> antes, cambiar el horómetro directo en la tabla de Equipos no dejaba ningún rastro en el historial de lecturas — con el tiempo, el ritmo real usado para proyectar el próximo PM quedaba calculado con datos de semanas o meses atrás, aunque el equipo ya llevara mucho más uso real. Se corrigió para todos los equipos afectados y ahora cada edición de horómetro queda registrada.</li>'+
    '</ul>'+
    '</div>'+

    // GUÍA DE TRASPASO (para quien tome el sistema)
    '<div class="card" style="margin-bottom:16px;border-left:3px solid var(--ac);background:rgba(99,102,241,.05)">'+
    '<b style="font-size:15px">🔑 GUÍA DE TRASPASO — Lee esto primero si recién recibes el sistema</b>'+
    '<p style="font-size:12px;color:var(--tx2);margin:10px 0">Este sistema gestiona el mantenimiento de una flota minera. Es una página web (se abre con Chrome o Edge, sin instalar nada) conectada a una base de datos real en la nube (Supabase) — los datos NO viven en este navegador, viven en el servidor, y se comparten entre todos los que usan el sistema al mismo tiempo.</p>'+
    '<b style="font-size:13px;color:var(--ac)">▶ Cómo empezar a usarlo (3 pasos)</b>'+
    '<ol style="font-size:12px;line-height:1.8;margin:8px 0 12px 18px">'+
    '<li><b>Inicia sesión</b> con tu correo y contraseña en la pantalla que aparece al abrir la página. Si no tienes cuenta todavía, pídele a un administrador que te la cree en <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.2"/><line x1="10" y1="2" x2="10" y2="4.2"/><line x1="10" y1="15.8" x2="10" y2="18"/><line x1="2" y1="10" x2="4.2" y2="10"/><line x1="15.8" y1="10" x2="18" y2="10"/><line x1="4.8" y1="4.8" x2="6.3" y2="6.3"/><line x1="13.7" y1="13.7" x2="15.2" y2="15.2"/><line x1="4.8" y1="15.2" x2="6.3" y2="13.7"/><line x1="13.7" y1="6.3" x2="15.2" y2="4.8"/></svg> Configuración → 👤 Crear Usuario del Sistema</b> — quedas bloqueado hasta que un admin te active (esto evita que cualquiera con el link entre sin autorización).</li>'+
    '<li><b>Familiarízate con las pestañas</b> de arriba. Las principales: <b>Dashboard</b> (resumen), <b>Equipos</b> (la flota y sus próximas PM), <b>Registro PM</b> (anotar mantenciones hechas), <b>Plan Semanal</b> (qué toca esta semana), <b>Stock</b> y <b>Lubricantes</b> (inventario), <b>Neumáticos</b> (control de gomas), <b>Predictivo</b> (qué materiales se vienen y cuánto cuestan).</li>'+
    '<li><b>Edita cualquier dato</b> haciendo click directo en las celdas de las tablas. Se guarda solo en la base de datos — nadie más necesita "actualizar" nada, lo ven apenas recarguen su pantalla. Para ordenar, haz click en los encabezados de columna (⇅).</li>'+
    '</ol>'+
    '<b style="font-size:13px;color:var(--ac)">▶ Tu rutina diaria recomendada</b>'+
    '<ol style="font-size:12px;line-height:1.8;margin:8px 0 12px 18px">'+
    '<li>Actualiza los <b>horómetros</b> de los equipos (pestaña Horómetros o en Equipos).</li>'+
    '<li>Revisa el <b>Dashboard</b>: equipos urgentes y próximas PM.</li>'+
    '<li>Cuando se haga una mantención, anótala en <b>Registro PM</b> → descuenta stock solo.</li>'+
    '<li>Si hay falla, créala en <b>Correctivos</b>.</li>'+
    '<li>Mide remanente de neumáticos críticos con el botón <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="7" width="16" height="6" rx="1"/><line x1="5" y1="7" x2="5" y2="9.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><line x1="11" y1="7" x2="11" y2="9.5"/><line x1="14" y1="7" x2="14" y2="9.5"/></svg> en <b>Neumáticos</b>.</li>'+
    '</ol>'+
    '<b style="font-size:13px;color:var(--ac)">▶ Respaldo y acceso desde otro equipo</b>'+
    '<p style="font-size:12px;line-height:1.7;margin:8px 0 12px 0">No hace falta respaldar nada a mano: los datos ya están en el servidor, no en este navegador. Para usar el sistema desde otro computador o celular, solo entra a la misma dirección web e inicia sesión con tu mismo usuario — vas a ver exactamente los mismos datos, al instante.</p>'+
    '<b style="font-size:13px;color:var(--ac)">▶ Conceptos clave del mantenimiento preventivo</b>'+
    '<p style="font-size:12px;line-height:1.7;margin:8px 0 0 0">Cada equipo tiene ciclos de PM: <b>PM1</b> (250h), <b>PM2</b> (500h), <b>PM3</b> (1.000h), <b>PM4</b> (2.000h). Un PM mayor incluye los menores (PM4 hace también PM1+2+3). El sistema calcula solo cuándo toca cada PM según el horómetro y avisa con colores: 🔴 urgente, 🟡 próxima, <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> al día.</p>'+
    '</div>'+

    // ROLES Y PERMISOS
    '<div class="card" style="margin-bottom:16px;border-left:3px solid #3ecf8e">'+
    '<b style="font-size:14px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Roles y permisos</b>'+
    '<p style="font-size:12px;line-height:1.7;margin:10px 0">Cada usuario tiene un rol asignado por un administrador: <b>operador</b> (puede registrar PM, correctivos, inspecciones, movimientos de stock, etc.) o <b>admin</b> (además puede crear/activar usuarios, editar datos estructurales del equipo como sigla/modelo/precios, y ver el panel de Configuración completo). Estos permisos los revisa la base de datos misma en cada acción — no son solo un candado de la pantalla, así que no se pueden saltar aunque alguien manipule el navegador.</p>'+
    '<p style="font-size:11px;color:var(--tx3)">Si dos personas editan la misma fila al mismo tiempo sin haber recargado la pantalla, el sistema detecta el conflicto, avisa con un mensaje, y pide reintentar sobre los datos frescos — así nunca se pierde en silencio el cambio de uno de los dos.</p>'+
    '</div>'+

    // ÍNDICE
    '<div class="card" style="margin-bottom:16px">'+
    '<div class="card-t" style="margin-bottom:8px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> ÍNDICE</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px">'+
    '<a href="#m1" style="color:var(--ac);text-decoration:none;padding:2px 0">1. ¿Qué es SistemaMP?</a>'+
    '<a href="#m2" style="color:var(--ac);text-decoration:none;padding:2px 0">2. Primeros pasos</a>'+
    '<a href="#m3" style="color:var(--ac);text-decoration:none;padding:2px 0">3. Flujo diario de trabajo</a>'+
    '<a href="#m4" style="color:var(--ac);text-decoration:none;padding:2px 0">4. Pestañas del sistema</a>'+
    '<a href="#m5" style="color:var(--ac);text-decoration:none;padding:2px 0">5. Registrar una PM</a>'+
    '<a href="#m6" style="color:var(--ac);text-decoration:none;padding:2px 0">6. Crear OT Correctiva</a>'+
    '<a href="#m7" style="color:var(--ac);text-decoration:none;padding:2px 0">7. Inspección diaria</a>'+
    '<a href="#m8" style="color:var(--ac);text-decoration:none;padding:2px 0">8. Control de repuestos</a>'+
    '<a href="#m9" style="color:var(--ac);text-decoration:none;padding:2px 0">9. Análisis predictivo</a>'+
    '<a href="#m10" style="color:var(--ac);text-decoration:none;padding:2px 0">10. Importar datos</a>'+
    '<a href="#m11" style="color:var(--ac);text-decoration:none;padding:2px 0">11. Exportar e imprimir</a>'+
    '<a href="#m12" style="color:var(--ac);text-decoration:none;padding:2px 0">12. Configuración</a>'+
    '<a href="#m13" style="color:var(--ac);text-decoration:none;padding:2px 0">13. Preguntas frecuentes</a>'+
    '<a href="#m14" style="color:var(--ac);text-decoration:none;padding:2px 0">14. Disponibilidad mecánica</a>'+
    '<a href="#m15" style="color:var(--ac);text-decoration:none;padding:2px 0">15. Planificación semanal</a>'+
    '<a href="#m16" style="color:var(--ac);text-decoration:none;padding:2px 0">16. Componentes mayores</a>'+
    '<a href="#m17" style="color:var(--ac);text-decoration:none;padding:2px 0">17. Metas vs Realidad</a>'+
    '<a href="#m18" style="color:var(--ac);text-decoration:none;padding:2px 0">18. Gantt de Mantención</a>'+
    '<a href="#m19" style="color:var(--ac);text-decoration:none;padding:2px 0">19. Gestión de Destrabe</a>'+
    '<a href="#m20" style="color:var(--ac);text-decoration:none;padding:2px 0">20. Avance Mensual</a>'+
    '<a href="#m21" style="color:var(--ac);text-decoration:none;padding:2px 0">21. Buscador Maestro</a>'+
    '<a href="#m22" style="color:var(--ac);text-decoration:none;padding:2px 0">22. Seguridad (AST/LOTO)</a>'+
    '<a href="#m23" style="color:var(--ac);text-decoration:none;padding:2px 0">23. Ficha Técnica de Equipo</a>'+
    '<a href="#m24" style="color:var(--ac);text-decoration:none;padding:2px 0">24. KPIs Avanzados</a>'+
    '<a href="#m25" style="color:var(--ac);text-decoration:none;padding:2px 0">25. Análisis de Aceite</a>'+
    '<a href="#m26" style="color:var(--ac);text-decoration:none;padding:2px 0">26. Dashboard — Bloques nuevos</a>'+
    '<a href="#m27" style="color:var(--ac);text-decoration:none;padding:2px 0">27. Vencimientos Documentales</a>'+
    '<a href="#m28" style="color:var(--ac);text-decoration:none;padding:2px 0">28. Tren de Rodaje</a>'+
    '<a href="#m29" style="color:var(--ac);text-decoration:none;padding:2px 0">29. Sensores de Neumáticos</a>'+
    '<a href="#m30" style="color:var(--ac);text-decoration:none;padding:2px 0">30. Programación Diaria</a>'+
    '<a href="#m31" style="color:var(--ac);text-decoration:none;padding:2px 0">31. Verificación en Dos Pasos</a>'+
    '</div></div>'+

    // 1. QUÉ ES
    '<div class="card" style="margin-bottom:12px" id="m1">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">1. ¿Qué es SistemaMP?</div>'+
    '<p style="font-size:13px;line-height:1.7;margin:0">SistemaMP Centinela es un sistema integral de gestión de mantenimiento para flotas de equipos mineros. Es una página web con una base de datos real en la nube (Supabase): necesita internet e iniciar sesión para funcionar, y los datos se comparten en vivo entre todos los usuarios de la empresa — no dependen de un solo computador ni de un solo navegador.</p>'+
    '<div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:6px;font-size:12px">'+
    '<b>El sistema responde 7 preguntas clave:</b><br>'+
    '🔴 ¿Qué está pasando? → Estado actual de la flota<br>'+
    '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> ¿Por qué? → Causa del problema<br>'+
    '🔮 ¿Qué va a pasar? → Proyección y riesgo<br>'+
    '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> ¿Qué debo hacer? → Acción recomendada<br>'+
    '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> ¿Qué pasa si no lo hago? → Impacto<br>'+
    '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> ¿Tengo cómo hacerlo? → Recursos disponibles<br>'+
    '🚀 ¿A dónde vamos? → Tendencia de la flota</div></div>'+

    // 2. PRIMEROS PASOS
    '<div class="card" style="margin-bottom:12px" id="m2">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">2. Primeros Pasos</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>Paso 1:</b> Abre la página en tu navegador (Chrome, Edge o Firefox) e <b>inicia sesión</b> con tu correo y contraseña.<br>'+
    '<b>Paso 2:</b> Revisa el <b>Dashboard</b> — muestra el estado general de la flota.<br>'+
    '<b>Paso 3:</b> Ve a <b>Equipos</b> — verifica que tus '+eq.length+' equipos estén correctos.<br>'+
    '<b>Paso 4:</b> Revisa <b>Pautas</b> — confirma las actividades PM de cada equipo.<br>'+
    '<b>Paso 5:</b> Ve a <b>Config</b> — personaliza empresa, colores y tema (algunas opciones piden además la contraseña interna 1234, distinta de tu login, solo para mostrar/ocultar ciertos paneles).<br>'+
    '<b>Paso 6:</b> ¡Listo! Empieza a registrar mantenciones.</div></div>'+

    // 3. FLUJO DIARIO
    '<div class="card" style="margin-bottom:12px" id="m3">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">3. Flujo Diario de Trabajo</div>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:8px;font-size:13px">'+
    '<div style="padding:10px;background:var(--bg3);border-radius:6px;border-left:3px solid #3b82f6">'+
    '<b>🌅 MAÑANA — Planificación</b><br>'+
    '1. Abre <b>Dashboard</b> → revisa equipos urgentes y alertas<br>'+
    '2. Revisa <b>Predictivo → Recomendaciones</b> → qué intervenir hoy<br>'+
    '3. Revisa <b>Repuestos</b> → semáforo de stock, hay 🔴? → comprar</div>'+

    '<div style="padding:10px;background:var(--bg3);border-radius:6px;border-left:3px solid #22c55e">'+
    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> DURANTE EL DÍA — Ejecución</b><br>'+
    '1. Realiza <b>Inspección Diaria</b> → pestaña <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> → checklist rápido<br>'+
    '2. Ejecuta PM → pestaña <b>Registro PM</b> → registra con horómetro real<br>'+
    '3. Si hay correctivo → pestaña <b>Correctivos</b> → crea OT con causa y solución<br>'+
    '4. El sistema descuenta stock automáticamente</div>'+

    '<div style="padding:10px;background:var(--bg3);border-radius:6px;border-left:3px solid #f59e0b">'+
    '<b>🌙 CIERRE — Registro y análisis</b><br>'+
    '1. Actualiza <b>Horómetros</b> de los equipos que trabajaron<br>'+
    '2. Revisa <b>Consumos</b> → ¿cuadran los filtros y lubricantes?<br>'+
    '3. Revisa <b>Costos</b> → gasto del día/mes<br>'+
    '4. Si llegaron muestras de aceite → pestaña <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="8"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="6.5" y1="2" x2="13.5" y2="2"/><polygon points="8,8 12,8 16,17 4,17"/><line x1="6" y1="13" x2="14" y2="13"/></svg> Análisis Aceite</b></div>'+

    '<div style="padding:10px;background:var(--bg3);border-radius:6px;border-left:3px solid #8b5cf6">'+
    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> SEMANAL — Planificación y Cierre</b><br>'+
    '1. <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Plan Semanal</b> → revisa los PM auto-generados para la semana<br>'+
    '2. Asigna técnicos y ajusta días si es necesario (Vista Tabla)<br>'+
    '3. Al ejecutar PM → ingresa <b>HH Real, Estado Real y Obs Real</b> en las columnas verdes<br>'+
    '4. Al terminar la semana → click <b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Cerrar Semana</b> (congela el Plan, Real queda editable)<br>'+
    '5. <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Avance</b> → revisa si vas al ritmo correcto del mes<br>'+
    '6. <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Gantt</b> → verifica la línea de tiempo del mes<br>'+
    '7. <b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0" fill="none"/></svg> Destrabe</b> → revisa trabajos bloqueados y gestiona soluciones<br>'+
    '8. <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Componentes Mayores</b> → revisa vida útil de motor, transmisión, etc.<br>'+
    '9. <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 8,10 11,7 17,16"/><polyline points="12,16 17,16 17,11"/></svg> Disponibilidad</b> → verifica % vs meta y tendencia<br>'+
    '10. Exporta informes → botón <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV o <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg> Imprimir para gerencia<br><br>'+
    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> MENSUAL — Cierre</b><br>'+
    '1. <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg> Metas</b> → compara plan vs real del mes que cierra<br>'+
    '2. <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Informes KPI</b> → descarga reportes para gerencia<br>'+
    '3. Ajusta metas del próximo mes según la realidad</div></div></div>'+

    // 4. PESTAÑAS
    '<div class="card" style="margin-bottom:12px" id="m4">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">4. Pestañas del Sistema</div>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Pestaña</th><th>Función</th><th>Qué se hace ahí</th></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Dashboard</b></td><td>Vista general</td><td>KPIs, gráficos, equipos urgentes, semáforos</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="4" width="6" height="6"/><line x1="9" y1="10" x2="4" y2="10"/><line x1="4" y1="10" x2="4" y2="13"/><circle cx="5.5" cy="15" r="2.5"/><circle cx="14" cy="15" r="3.5"/><line x1="15" y1="10" x2="15" y2="4"/></svg> Equipos</b></td><td>Flota completa</td><td>Ver/editar equipos, horómetros, estado PM</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg> Registro PM</b></td><td>Mantención preventiva</td><td>Registrar cada PM con fechas, técnico, horómetro</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Correctivos</b></td><td>OT correctivas</td><td>Crear OT, registrar causa raíz, solución, componente, backlog</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3"/></svg> Neumáticos</b></td><td>Control neumáticos</td><td>Remanente, cambios, historial por posición, sensores de presión (ver sección 29)</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Programa</b></td><td>Programa anual</td><td>Planificación mensual de PMs por equipo</td></tr>'+
    '<tr><td><b>🔴 Alertas PM4</b></td><td>Repuestos PM4</td><td>Checklist de repuestos para PM4 / overhaul</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Pautas</b></td><td>Actividades PM</td><td>Todas las actividades por tipo PM, editables</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock Filtros</b></td><td>Inventario filtros</td><td>Stock, consumo, proyección, semáforo compra</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg> Lubricantes</b></td><td>Inventario lubricantes</td><td>Stock, consumo, proyección, precio</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costos</b></td><td>Análisis de costos</td><td>3 vistas: Costos por mes, HH por técnico/equipo con eficiencia, MTBF/MTTR por equipo</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Horómetros</b></td><td>Historial lecturas</td><td>Registro y tendencia de horas por equipo</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 8,10 11,7 17,16"/><polyline points="12,16 17,16 17,11"/></svg> Disponibilidad</b></td><td>% disponibilidad</td><td>Cálculo dinámico desde registros, meta editable, tendencia mensual</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Consumos</b></td><td>Historial consumos</td><td>Todos los movimientos de filtros y lubricantes</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="8"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="6.5" y1="2" x2="13.5" y2="2"/><polygon points="8,8 12,8 16,17 4,17"/><line x1="6" y1="13" x2="14" y2="13"/></svg> Análisis Aceite</b></td><td>Muestras aceite</td><td>Metales de desgaste, estado, tendencia por componente</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Inspecciones</b></td><td>Checklist diario</td><td>Visual, niveles, fugas, luces, frenos, neumáticos</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Repuestos</b></td><td>Control repuestos</td><td>Stock, mínimo, lead time, semáforo, orden de compra</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Predictivo</b></td><td>Motor inteligente</td><td>Alertas cruzadas, diagnóstico, backlog, tendencias</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Plan Semanal</b></td><td>Planificación semanal</td><td>Trabajos de la semana, HH, costo, técnicos, repuestos</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 A6 6 0 0 1 16 11" fill="none"/><line x1="2" y1="11" x2="18" y2="11"/><line x1="10" y1="5" x2="10" y2="3"/></svg> Prog. Diaria</b></td><td>Personal por turno</td><td>Importa el Excel de terreno, dotación por bloques de 30 min día/noche (ver sección 30)</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Componentes</b></td><td>Componentes mayores</td><td>5 sub-pestañas: Componentes Mayores (motor/transmisión/diferencial), Predictivo, Destrabe, Informes de Falla (genera PDF descargable) y Tren de Rodaje (eslabones, bujes, zapatas, sprockets)</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg> Metas</b></td><td>Plan vs Real</td><td>8 indicadores × 12 meses, meta editable, real automático</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Gantt</b></td><td>Plan visual</td><td>Equipos × días del mes, barras de color por estado</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0" fill="none"/></svg> Destrabe</b></td><td>Bloqueos</td><td>Trabajos detenidos, motivo, acción, días pendiente</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Avance</b></td><td>Progreso mensual</td><td>Plan vs ejecución con barra de progreso y % esperado</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg> Buscar</b></td><td>Buscador Maestro</td><td>Historial completo por equipo, ranking de problemáticos</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Informes KPI</b></td><td>Cuadro de mando</td><td>6 gauges + barras mensuales + descarga Excel</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg> Log</b></td><td>Auditoría</td><td>Registro automático de todas las ediciones con fecha/hora</td></tr>'+
    '<tr><td><b>📖 Manual</b></td><td>Esta guía</td><td>Paso a paso de todo el sistema</td></tr>'+
    '<tr><td><b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.2"/><line x1="10" y1="2" x2="10" y2="4.2"/><line x1="10" y1="15.8" x2="10" y2="18"/><line x1="2" y1="10" x2="4.2" y2="10"/><line x1="15.8" y1="10" x2="18" y2="10"/><line x1="4.8" y1="4.8" x2="6.3" y2="6.3"/><line x1="13.7" y1="13.7" x2="15.2" y2="15.2"/><line x1="4.8" y1="15.2" x2="6.3" y2="13.7"/><line x1="13.7" y1="6.3" x2="15.2" y2="4.8"/></svg> Config</b></td><td>Administración</td><td>Temas, colores, fuentes, backup, nueva empresa, crear/activar usuarios, códigos QR por equipo</td></tr>'+
    '</table></div></div>'+

    // 5. REGISTRAR PM
    '<div class="card" style="margin-bottom:12px" id="m5">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">5. Cómo Registrar una PM</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>1.</b> Ve a <b>Registro PM</b> → click <b>"+ Registrar PM"</b><br>'+
    '<b>2.</b> Selecciona el <b>equipo</b> (ej: CN-9507)<br>'+
    '<b>3.</b> Selecciona <b>tipo de PM</b> (PM1, PM2, PM3, PM4 o Correctivo)<br>'+
    '<b>4.</b> Ingresa <b>horómetro real</b> del equipo<br>'+
    '<b>5.</b> Ingresa fechas y horas de entrada/salida<br>'+
    '<b>6.</b> Selecciona técnico y agrega observaciones<br>'+
    '<b>7.</b> Click <b>"<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar"</b><br><br>'+
    '<div style="padding:8px;background:var(--bg3);border-radius:6px">'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> El sistema automáticamente:</b><br>'+
    '• Actualiza el horómetro del equipo<br>'+
    '• Recalcula próximo PM y días restantes<br>'+
    '• Descuenta filtros y lubricantes del stock según la pauta<br>'+
    '• Registra los movimientos en Consumos<br>'+
    '• Actualiza Dashboard, Costos y Predictivo</div></div></div>'+

    // 6. CREAR OT
    '<div class="card" style="margin-bottom:12px" id="m6">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">6. Cómo Crear una OT Correctiva</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>1.</b> Ve a <b>Correctivos</b> → click <b>"+ Nueva OT"</b><br>'+
    '<b>2.</b> Selecciona equipo, tipo, estatus<br>'+
    '<b>3.</b> Ingresa fechas entrada/salida y horómetro<br>'+
    '<b>4.</b> Describe el <b>síntoma</b> (qué pasó)<br>'+
    '<b>5.</b> Ingresa <b>causa raíz</b> (por qué pasó)<br>'+
    '<b>6.</b> Selecciona <b>componente</b> afectado (Motor, Bomba, etc.)<br>'+
    '<b>7.</b> Describe la <b>solución</b> aplicada<br>'+
    '<b>8.</b> Selecciona <b>estado OT</b> (Pendiente / En Ejecución / Cerrada)<br><br>'+
    '<div style="padding:8px;background:var(--bg3);border-radius:6px">'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Importante:</b> Si el mismo componente falla 2+ veces en el mismo equipo, el sistema genera alerta automática y lo refleja en el Predictivo como falla recurrente.</div></div></div>'+

    // 7. INSPECCIÓN
    '<div class="card" style="margin-bottom:12px" id="m7">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">7. Cómo Hacer Inspección Diaria</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>1.</b> Ve a <b>Inspecciones</b> → click <b>"+ Nueva Inspección"</b><br>'+
    '<b>2.</b> Selecciona equipo, fecha, horómetro, inspector<br>'+
    '<b>3.</b> Marca cada ítem: <b>OK</b> o <b>NOK</b><br>'+
    '&nbsp;&nbsp;&nbsp;• Estado Visual<br>'+
    '&nbsp;&nbsp;&nbsp;• Niveles de fluidos<br>'+
    '&nbsp;&nbsp;&nbsp;• Fugas<br>'+
    '&nbsp;&nbsp;&nbsp;• Luces<br>'+
    '&nbsp;&nbsp;&nbsp;• Frenos<br>'+
    '&nbsp;&nbsp;&nbsp;• Neumáticos<br>'+
    '<b>4.</b> Agrega observaciones si hay NOK<br>'+
    '<b>5.</b> Los NOK alimentan automáticamente la alerta cruzada del Predictivo</div></div>'+

    // 8. REPUESTOS
    '<div class="card" style="margin-bottom:12px" id="m8">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">8. Control de Repuestos</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>Semáforo automático:</b><br>'+
    '🔴 <b>SIN STOCK / PEDIR YA</b> — stock cero o stock menor al lead time → comprar inmediato<br>'+
    '🟡 <b>STOCK BAJO</b> — stock menor al mínimo → planificar compra<br>'+
    '🟢 <b>OK</b> — stock suficiente<br><br>'+
    '<b>Flujo de compra:</b><br>'+
    '1. Semáforo marca 🔴 → click <b>"<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3 4,3 6,12 15,12 17,6 5,6"/><circle cx="7" cy="16" r="1.3"/><circle cx="14" cy="16" r="1.3"/></svg> Comprar"</b><br>'+
    '2. Se abre formulario de Orden de Compra con cantidad y costo sugeridos<br>'+
    '3. Confirmas → se guarda la OC<br>'+
    '4. Cuando llega el repuesto → editas stock directamente en la tabla<br><br>'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Sincronizar Stock:</b> actualiza automáticamente desde Stock Filtros y Lubricantes</div></div>'+

    // 9. PREDICTIVO
    '<div class="card" style="margin-bottom:12px" id="m9">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">9. Análisis Predictivo</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>4 vistas disponibles:</b><br><br>'+
    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> General:</b> Recomendaciones automáticas, alertas cruzadas por equipo (combina inspecciones + aceite + fallas + PM), quiebres de stock, tendencia costos.<br><br>'+
    '<b>🏗 Por Equipo:</b> Selecciona un equipo y ve su historial completo: pedidos, costos, confianza de la predicción, items más pedidos.<br><br>'+
    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Backlog Inteligente:</b> Todos los trabajos pendientes con: días atrasados, origen (correctivo/preventivo), motivo (editable) e impacto (según criticidad del equipo y si está fuera de servicio).<br><br>'+
    '<b>🧠 Diagnóstico Integral:</b> Responde las 7 preguntas para cualquier equipo. Genera un párrafo de interpretación automática tipo:<br>'+
    '<div style="padding:8px;background:var(--bg3);border-radius:6px;margin-top:4px;font-style:italic;font-size:12px">'+
    '"CN-9507 presenta PM1 vencida. Aceite ALERTA en motor (Fe:120). Causa: desgaste interno. Riesgo de falla en 14 días. Acción: Programar PM1 inmediato. 2 repuestos sin stock — requiere compra."</div></div></div>'+

    // 10. IMPORTAR
    '<div class="card" style="margin-bottom:12px" id="m10">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">10. Importar Datos</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>Cada pestaña tiene su botón de importación:</b><br><br>'+
    '<table style="font-size:12px;width:100%"><tr><th>Pestaña</th><th>Formato</th><th>Columnas</th></tr>'+
    '<tr><td>Correctivos</td><td>CSV/JSON</td><td>sigla, fecha, tipo, sintoma, tecnico, horom, costo</td></tr>'+
    '<tr><td>Horómetros</td><td>CSV</td><td>sigla, fecha, horometro</td></tr>'+
    '<tr><td>Neumáticos</td><td>CSV/JSON</td><td>sigla, posicion, serie, marca, medida, remanente, estado</td></tr>'+
    '<tr><td>Repuestos</td><td>CSV (pedidos)</td><td>nPI, fecha, sigla, cantidad, detalle, precioUnit, proveedor</td></tr>'+
    '<tr><td>Análisis Aceite</td><td>CSV</td><td>nMuestra, fecha, componente, hierro, cobre, plomo, estado</td></tr>'+
    '</table><br>'+
    '<b>Backup completo:</b> En Config → "<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Exportar JSON" guarda todo, "<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar JSON" lo restaura.</div></div>'+

    // 11. EXPORTAR
    '<div class="card" style="margin-bottom:12px" id="m11">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">11. Exportar e Imprimir</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    'En <b>cualquier pestaña</b> hay 2 botones flotantes abajo a la derecha:<br><br>'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</b> — Exporta la tabla actual a archivo CSV (se abre en Excel)<br>'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg> Imprimir</b> — Abre ventana de impresión con formato profesional. Desde ahí puedes:<br>'+
    '&nbsp;&nbsp;&nbsp;• Imprimir directo en papel<br>'+
    '&nbsp;&nbsp;&nbsp;• Guardar como PDF (opción "Guardar como PDF" en el diálogo)<br><br>'+
    '<b>Tip:</b> Para informes de gerencia, usa el Diagnóstico Integral del Predictivo → Imprimir → PDF.</div></div>'+

    // 12. CONFIG
    '<div class="card" style="margin-bottom:12px" id="m12">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">12. Configuración</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>Acceso:</b> Contraseña por defecto: <b>1234</b> (se puede cambiar)<br><br>'+
    '<b>Opciones disponibles:</b><br>'+
    '• <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="4" y="2" width="12" height="16"/><rect x="6.3" y="4.5" width="1.8" height="1.8"/><rect x="9.1" y="4.5" width="1.8" height="1.8"/><rect x="11.9" y="4.5" width="1.8" height="1.8"/><rect x="6.3" y="8" width="1.8" height="1.8"/><rect x="9.1" y="8" width="1.8" height="1.8"/><rect x="11.9" y="8" width="1.8" height="1.8"/><rect x="8.5" y="13" width="3" height="5"/></svg> Empresa y faena<br>'+
    '• 🎨 Tema: Oscuro / Claro / Azul Minero<br>'+
    '• 🎨 Colores personalizables: principal, OK, peligro<br>'+
    '• <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Opciones de Dashboard: gráficos, proyección, costos<br>'+
    '• <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Exportar/Importar backup JSON<br>'+
    '• <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Restaurar datos iniciales<br>'+
    '• <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="4" y="2" width="12" height="16"/><rect x="6.3" y="4.5" width="1.8" height="1.8"/><rect x="9.1" y="4.5" width="1.8" height="1.8"/><rect x="11.9" y="4.5" width="1.8" height="1.8"/><rect x="6.3" y="8" width="1.8" height="1.8"/><rect x="9.1" y="8" width="1.8" height="1.8"/><rect x="11.9" y="8" width="1.8" height="1.8"/><rect x="8.5" y="13" width="3" height="5"/></svg> Configurar nueva empresa (resetear todo y empezar de cero)</div></div>'+

    // 13. FAQ
    '<div class="card" style="margin-bottom:12px" id="m13">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">13. Preguntas Frecuentes</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Se pierden los datos si cierro el navegador?</b><br>'+
    'No. Los datos viven en la base de datos en la nube (Supabase), no en tu navegador — cerrar la pestaña o apagar el computador no borra nada. Vuelves a entrar, inicias sesión, y está todo tal como lo dejaste.<br><br>'+
    '<b>¿Funciona sin internet?</b><br>'+
    'No — necesita internet para iniciar sesión y para guardar/leer cualquier dato, porque todo vive en el servidor, no localmente.<br><br>'+
    '<b>¿Puedo usar el sistema en otro computador?</b><br>'+
    'Sí, y es más simple que antes: solo entra a la misma página desde el otro computador (o celular) e inicia sesión con tu mismo usuario. No hace falta exportar ni copiar ningún archivo — vas a ver los mismos datos en vivo.<br><br>'+
    '<b>¿Puedo usarlo en celular?</b><br>'+
    'Sí, funciona en el navegador del celular. La interfaz se adapta a pantallas pequeñas.<br><br>'+
    '<b>¿Puedo cambiar de empresa?</b><br>'+
    'Sí. En Config → "<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="4" y="2" width="12" height="16"/><rect x="6.3" y="4.5" width="1.8" height="1.8"/><rect x="9.1" y="4.5" width="1.8" height="1.8"/><rect x="11.9" y="4.5" width="1.8" height="1.8"/><rect x="6.3" y="8" width="1.8" height="1.8"/><rect x="9.1" y="8" width="1.8" height="1.8"/><rect x="11.9" y="8" width="1.8" height="1.8"/><rect x="8.5" y="13" width="3" height="5"/></svg> Configurar Nueva Empresa" → sube CSV con equipos nuevos. La arquitectura completa se mantiene.<br><br>'+
    '<b>¿Cuántos equipos soporta?</b><br>'+
    'Sin límite técnico. Funciona bien con 50+ equipos.<br><br>'+
    '<b>¿Los cambios se propagan automáticamente?</b><br>'+
    'Sí. Cada edición en cualquier pestaña llama refreshAll() que actualiza Dashboard, header y la pestaña actual. Todo está interconectado.<br><br>'+
    '<b>¿Cómo hago backup?</b><br>'+
    'Config → "<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Exportar JSON". Guarda el archivo. Para restaurar: "<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar JSON". También tienes el archivo Excel Plan B como respaldo independiente.</div></div>'+

    // 14. DISPONIBILIDAD MECÁNICA
    '<div class="card" style="margin-bottom:12px" id="m14">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">14. Disponibilidad Mecánica</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Qué es?</b> La disponibilidad mecánica mide el % de tiempo que un equipo está operativo vs el tiempo total programado. La meta estándar en minería es <b>85%</b>.<br><br>'+
    '<b>¿Cómo se calcula?</b> El sistema recorre día por día del mes usando una única fuente de detenciones (registros PM + correctivos + salidas de servicio) — la misma fuente que usan Disponibilidad, Dashboard, KPI y Metas, para que el número nunca sea distinto según qué pestaña mires. También puedes ingresar datos manualmente editando las celdas azules (tiene prioridad sobre el cálculo automático).<br><br>'+
    '<b>▶ <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><line x1="4.5" y1="15.5" x2="15.5" y2="4.5"/></svg> Registrar salida de servicio</b><br>'+
    'Marca un equipo como fuera de servicio un rango de días completo (cuentan como 0% de disponibilidad esos días). Si todavía no sabes cuándo vuelve a operar, marca la casilla <b>"El equipo AÚN sigue fuera de servicio"</b> en vez de inventar una fecha de término — así el equipo sigue contando como detenido día a día hasta que lo cierres. Los equipos con una salida en curso aparecen en una franja roja arriba de la tabla, con un botón <b>"<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Volvió a operar"</b> para fijar la fecha real de término cuando corresponda.<br><br>'+
    '<b>Vistas disponibles:</b><br>'+
    '• <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Por Equipo</b>: tabla con barra visual, semáforo vs meta, % editable<br>'+
    '• <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Tendencia Mensual</b>: todos los meses en columnas para ver evolución<br><br>'+
    '<b>Funciones:</b><br>'+
    '• La <b>meta es editable</b> — click en el porcentaje para cambiarla<br>'+
    '• Cada celda de % es <b>editable manualmente</b> si necesitas corregir<br>'+
    '• Los datos de disponibilidad de abril (Excel original) se cargan como fallback<br>'+
    '• Puedes <b>importar CSV</b> con formato: Equipo, 2026-01, 2026-02, ...<br>'+
    '• Puedes <b>exportar CSV</b> con los datos calculados</div></div>'+

    // 15. PLANIFICACIÓN SEMANAL
    '<div class="card" style="margin-bottom:12px" id="m15">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">15. Planificación Semanal</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Para qué sirve?</b> Planificar semana a semana los PM de la flota, registrar lo ejecutado vs lo planificado, y mantener un histórico congelado por semana.<br><br>'+

    '<div style="padding:8px 10px;background:var(--bg3);border-radius:6px;border-left:3px solid var(--warn);margin-bottom:10px;font-size:12px">'+
    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> La semana va de JUEVES a MIÉRCOLES</b>, igual que la semana operativa de la faena — no de lunes a domingo. '+
    'Por eso el calendario parte en Jue y cierra en Mié, y el rango de fechas que muestra el título de cada semana sigue ese mismo corte.</div>'+

    '<div style="padding:10px;background:var(--bg3);border-radius:6px;border-left:3px solid var(--ac);margin-bottom:10px">'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Cómo funciona el flujo completo:</b><br>'+
    '<b>1. Auto-generación:</b> El sistema detecta equipos con PM ≤14 días y los carga automáticamente.<br>'+
    '<b>2. Auto-asignación de día:</b> Cada PM recibe un día según urgencia — sin tocar nada tú.<br>'+
    '<b>3. Ajuste manual:</b> En Vista Tabla puedes reasignar día, técnico, HH, observaciones.<br>'+
    '<b>4. Registro del Real:</b> Al ejecutar el PM, ingresa HH Real, Estado Real y Obs Real.<br>'+
    '<b>5. Cierre:</b> Al final de la semana haz click en <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Cerrar Semana — queda congelado.<br>'+
    '<b>6. Histórico:</b> Navega cualquier semana anterior con el selector y verás el histórico exacto.</div>'+

    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Vista Calendario:</b><br>'+
    '• Muestra los PM ubicados en su día de la semana (Jue-Mié)<br>'+
    '• Color por tipo: verde PM1, azul PM2, amarillo PM3, rojo PM4<br>'+
    '• Los PM ejecutados muestran ✓ y las horas reales<br>'+
    '• Hoy se resalta en naranja<br><br>'+

    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Vista Tabla (edición):</b><br>'+
    '• <b>HH Plan / Costo Est:</b> auto-calculados desde pautas, editables<br>'+
    '• <b>Técnico:</b> asignar mecánico responsable<br>'+
    '• <b>Día:</b> auto-asignado por urgencia, editable<br>'+
    '• <b>Estado Plan:</b> Planificado → Confirmado → En Ejecución → Ejecutado → Postergado<br>'+
    '• <b>Repuestos:</b> auto-generados desde pautas, editables<br>'+
    '• <b style="color:var(--ok)">HH Real:</b> horas reales ejecutadas (siempre editable)<br>'+
    '• <b style="color:var(--ok)">Estado Real:</b> Ejecutado / Parcial / No Ejecutado / Postergado<br>'+
    '• <b style="color:var(--ok)">Obs Real:</b> notas del técnico sobre lo ejecutado<br><br>'+

    '<b>🤖 Auto-asignación de días por urgencia:</b><br>'+
    '• 0-2 días para PM → <b>Jueves</b> (primer día de la semana; urgente, prioridad máxima)<br>'+
    '• 3-5 días → <b>Viernes o Sábado</b> (balanceado automático)<br>'+
    '• 6-10 días → <b>Lunes o Martes</b><br>'+
    '• 11-14 días → <b>Miércoles o Martes</b><br>'+
    '• Si cambias el día manualmente, el sistema respeta tu elección<br><br>'+

    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Cierre y Histórico:</b><br>'+
    '• Semanas pasadas muestran badge <b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> PASADA</b> y botón <b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Cerrar Semana</b><br>'+
    '• Al cerrar: el <b>Plan queda congelado</b> (no se modifica)<br>'+
    '• El <b>Real sigue editable</b> — puedes corregir HH Real si ingresas horómetros atrasados<br>'+
    '• El selector de semanas marca con <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> las semanas cerradas<br>'+
    '• Botón <b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0" fill="none"/></svg> Reabrir</b> disponible si necesitas corregir el Plan también<br><br>'+

    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> KPIs:</b><br>'+
    '• <b>Trabajos Semana:</b> total de PM en el plan<br>'+
    '• <b>HH Plan:</b> horas-hombre planificadas<br>'+
    '• <b>HH Real</b> (semanas pasadas): horas efectivamente ejecutadas<br>'+
    '• <b>Cumplimiento %</b> (semanas pasadas): HH Real ÷ HH Plan × 100 (🟢≥80%, 🟡≥50%, 🔴<50%)<br>'+
    '• <b>Costo Estimado:</b> HH Plan × tarifa HH<br><br>'+

    '<div style="padding:8px;background:var(--bg3);border-radius:6px;border-left:3px solid var(--ok)">'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> Tip — Horómetros atrasados:</b> Si ingresas datos de semanas pasadas que ya cerraste, '+
    've a esa semana cerrada en Vista Tabla y edita directamente las columnas verdes (HH Real, Estado Real, Obs Real). '+
    'El Plan permanece intacto y el Real queda actualizado.</div></div></div>'+

    // 16. COMPONENTES MAYORES
    '<div class="card" style="margin-bottom:12px" id="m16">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">16. Componentes Mayores</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Qué son?</b> Motor, transmisión, diferencial, convertidor, mandos finales y bomba hidráulica — los componentes de alto costo cuyo reemplazo se planifica a largo plazo.<br><br>'+
    '<b>Sin fecha de instalación, NO se inventa un % de vida.</b> Antes el sistema asumía que todo componente estaba "recién instalado" (0h de uso) hasta que alguien decía lo contrario — eso hacía que motores con 20.000+ horas reales figuraran como casi nuevos, sin ninguna alerta. Ahora cada componente necesita uno de estos dos datos para tener proyección:<br>'+
    '• <b>Casilla "Orig." marcada</b>: es el componente original del equipo (instalado nuevo de fábrica) → sus horas usadas = el horómetro completo del equipo, sin necesitar fecha.<br>'+
    '• <b>Fecha de instalación</b> (si se cambió en algún momento): el sistema <b>estima el horómetro que tenía el equipo en esa fecha</b> a partir del ritmo real de uso de ese equipo (aparece marcado con "≈"). Si conoces el horómetro medido real de la instalación, escríbelo en "Horóm. Inst." y reemplaza la estimación.<br>'+
    'Mientras un componente no tenga ninguno de los dos datos, queda marcado <b>⚪ Falta instalación</b> y no entra en los KPIs de críticos ni en el costo proyectado — un aviso arriba de la tabla indica cuántos componentes faltan por completar.<br><br>'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Ojo con equipos de muchas horas:</b> si el horómetro actual ya superó la vida útil normal del componente, ese componente probablemente ya se cambió — usa la fecha del <b>último cambio real</b>, no la fecha de puesta en marcha del equipo.<br><br>'+
    '<b>¿Qué calcula?</b><br>'+
    '• <b>Horas usadas</b>: horómetro actual del equipo menos horómetro de instalación (medido o estimado)<br>'+
    '• <b>% de vida</b>: barra visual que muestra cuánto se ha consumido la vida útil<br>'+
    '• <b>Horas restantes</b>: vida útil menos horas usadas<br>'+
    '• <b>Días restantes</b>: horas restantes ÷ ritmo real de uso del equipo<br>'+
    '• <b>Estado</b>: 🟢 OK → <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> MONITOREAR (<2000h) → 🟡 PLANIFICAR (<1000h) → 🔴 VENCIDO (0h)<br><br>'+
    '<b>Columnas editables:</b> componente, casilla Original, horómetro de instalación, fecha de instalación, vida útil, costo de referencia, observaciones.<br><br>'+
    '<b>KPIs:</b> total componentes, críticos (<1000h), costo proyectado de próximos cambios, componentes con instalación pendiente de completar.<br>'+
    '<b>Botones:</b> + Agregar, <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg> Eliminar, <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV, <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar<br><br>'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Informes de Falla (PDF):</b> en esta misma pestaña "Componentes" hay una sub-pestaña llamada <b>"<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Informes de Falla"</b> (botón arriba, junto a Componentes Mayores/Predictivo/Destrabe). Ahí se genera el informe formal de una falla catastrófica o cambio de componente: llenas el formulario, adjuntas fotos, y al guardar el botón <b>"<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Generar Informe y PDF"</b> descarga automáticamente un PDF con todo el detalle. Para volver a descargar un informe ya creado, usa el botón <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> en su fila de la tabla.</div></div>'+

    // 17. METAS
    '<div class="card" style="margin-bottom:12px" id="m17">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">17. Metas vs Realidad</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Para qué sirve?</b> Definir objetivos mensuales y comparar contra la realidad. Responde la pregunta: ¿estamos cumpliendo lo que planificamos?<br><br>'+
    '<b>8 indicadores:</b> Disponibilidad, PMs a ejecutar, Cumplimiento, Gasto máximo, HH máximas, Ratio preventivo, MTBF mínimo, OT pendientes máximas.<br><br>'+
    '<b>Cómo funciona:</b><br>'+
    '• Cada indicador tiene una META ANUAL (editable) que se replica en los 12 meses<br>'+
    '• La META mensual es editable — puedes ajustarla mes a mes<br>'+
    '• El REAL se calcula automático desde los registros PM y correctivos<br>'+
    '• Verde = cumple meta, Rojo = no cumple<br><br>'+
    '<b>Uso:</b> Al cierre de cada mes, revisa esta pestaña para ver dónde cumpliste y dónde no. Ajusta las metas del próximo mes según la realidad.</div></div>'+

    // 18. GANTT
    '<div class="card" style="margin-bottom:12px" id="m18">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">18. Gantt de Mantención</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Para qué sirve?</b> Visualizar el plan de mantención en una línea de tiempo. Ver cuándo entra cada equipo, cuánto dura, y si hay conflictos.<br><br>'+
    '<b>Cómo funciona:</b><br>'+
    '• Selector de mes arriba — elige qué mes ver<br>'+
    '• Cada fila es un equipo — edita Fecha Inicio y Fecha Fin<br>'+
    '• Las celdas de los días se pintan automático según el estado:<br>'+
    '  🔵 Azul = Planificado · 🟢 Verde = Ejecutado · 🔴 Rojo = Atrasado · 🟡 Amarillo = En Ejecución<br>'+
    '• Línea vertical marca el día actual<br>'+
    '• % Avance editable por equipo<br><br>'+
    '<b>Estados:</b> Planificado → En Ejecución → Ejecutado / Atrasado / Postergado</div></div>'+

    // 19. DESTRABE
    '<div class="card" style="margin-bottom:12px" id="m19">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">19. Gestión de Destrabe</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Para qué sirve?</b> Registrar y gestionar trabajos que están bloqueados. Responde: ¿por qué no avanza? ¿qué necesito para destrabarlo?<br><br>'+
    '<b>Columnas:</b><br>'+
    '• <b>Equipo</b> y <b>Trabajo</b> — qué está bloqueado<br>'+
    '• <b>Motivo Bloqueo</b> — por qué está detenido (sin repuesto, sin técnico, sin autorización, equipo en operación, esperando proveedor, clima, falta herramienta, prioridad reasignada)<br>'+
    '• <b>Acción Requerida</b> — qué hay que hacer para destrabarlo<br>'+
    '• <b>Responsable</b> — quién tiene que actuar<br>'+
    '• <b>Fecha Compromiso</b> — para cuándo<br>'+
    '• <b>Días Detenido</b> — se calcula automático desde fecha solicitud<br>'+
    '• <b>Prioridad</b> — automática: >14 días = 🔴 CRÍTICO, >7 = 🟡 URGENTE<br>'+
    '• <b>Estado</b> — Bloqueado / En Gestión / Resuelto</div></div>'+

    // 20. AVANCE
    '<div class="card" style="margin-bottom:12px" id="m20">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">20. Avance Mensual</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Para qué sirve?</b> Ver si vas al ritmo correcto para cumplir el plan del mes. Responde: ¿cómo vamos de avanzado?<br><br>'+
    '<b>Cómo funciona:</b><br>'+
    '• <b>Barra de progreso general</b> — muestra el avance de toda la flota con una línea vertical que marca dónde deberías estar según el día del mes<br>'+
    '• <b>PM Planificados</b> (azul, editable) — cuántos PMs programaste para este equipo este mes<br>'+
    '• <b>PM Ejecutados</b> (automático) — cuántos se ejecutaron realmente (cuenta desde Registro PM)<br>'+
    '• <b>% Avance</b> — ejecutados ÷ planificados<br>'+
    '• <b>% Esperado</b> — día actual ÷ días del mes (si estamos a día 15 de 30, deberías ir en 50%)<br>'+
    '• <b>Diferencia</b> — avance real menos esperado. Positivo = adelantado, negativo = atrasado<br>'+
    '• <b>Estado</b> — <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> EN PLAN / <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> RIESGO / 🔴 ATRASADO<br><br>'+
    '<div style="padding:8px;background:var(--bg3);border-radius:6px;border-left:3px solid var(--ac)">'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> Tip:</b> Revisa esta pestaña cada jueves, al abrir la semana. Si la barra está por debajo de la línea esperada, necesitas acelerar las intervenciones esa semana.</div></div></div>'+

    // 21. BUSCADOR MAESTRO
    '<div class="card" style="margin-bottom:12px" id="m21">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">21. Buscador Maestro</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Para qué sirve?</b> Responder cualquier pregunta sobre un equipo en segundos. Cuando gerencia pregunta "¿qué pasó con el CN-9503 el mes pasado?", aquí tienes la respuesta completa.<br><br>'+
    '<b>Dos modos:</b><br>'+
    '• <b>Sin equipo seleccionado</b> → muestra el Ranking de Equipos Problemáticos ordenado por cantidad de fallas y costo. Click en cualquier equipo para ver su historial.<br>'+
    '• <b>Con equipo seleccionado</b> → muestra TODO el historial del equipo en una pantalla:<br>'+
    '  — Ficha: tipo, modelo, horómetro, estado, próximo PM<br>'+
    '  — KPIs: PMs ejecutados, correctivos, MTBF, HH, costo<br>'+
    '  — Registros PM del período<br>'+
    '  — Correctivos con código de falla y causa raíz<br>'+
    '  — Componentes mayores con vida restante<br>'+
    '  — Horómetros recientes<br>'+
    '  — Inspecciones<br><br>'+
    '<b>Filtros:</b> equipo + fecha desde + fecha hasta. Puedes acotar a un mes, una semana o cualquier rango.</div></div>'+

    // 22. SEGURIDAD
    '<div class="card" style="margin-bottom:12px" id="m22">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">22. Seguridad — AST / LOTO / Código de Falla</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>Campos de seguridad en Correctivos y Registro PM:</b><br><br>'+
    '<b>AST (Análisis Seguro de Trabajo):</b> Registro de si se completó el AST antes de la intervención. Obligatorio en minería. Opciones: Sí / No / N/A.<br><br>'+
    '<b>LOTO (Lockout/Tagout):</b> Registro de si se aplicó el protocolo de bloqueo de energías. Opciones: Sí / No / N/A.<br><br>'+
    '<b>Código de Falla (solo Correctivos):</b> Clasificación del tipo de falla: Eléctrico, Hidráulico, Mecánico, Estructural, Neumático, Motor, Transmisión, Error Operación, Otro. Permite análisis estadístico de fallas por tipo.<br><br>'+
    '<b>Autorizado por (solo Correctivos):</b> Quién autorizó la intervención. Trazabilidad para auditoría ISO.<br><br>'+
    '<div style="padding:8px;background:var(--bg3);border-radius:6px;border-left:3px solid #ef4444">'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Importante:</b> En minería, una OT sin AST y LOTO registrado es una no conformidad grave en auditoría. Siempre completa estos campos.</div></div></div>'+

    '<div class="card" style="margin-bottom:12px" id="m23">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">23. Ficha Técnica de Equipo</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Cómo acceder?</b> En la pestaña Equipos, click en el botón <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> de cualquier equipo.<br><br>'+
    '<b>Campos disponibles:</b><br>'+
    '• Sigla, Tipo, Modelo — datos básicos<br>'+
    '• N° Serie, Año Fabricación, VIN/Chasis — identificación<br>'+
    '• Proveedor, Valor Compra, Fecha Compra — datos comerciales<br>'+
    '• Garantía Hasta (hrs) — si el equipo está bajo garantía, al superar este horómetro la garantía vence<br>'+
    '• Contrato Servicio — si tiene contrato con el fabricante (ej: Komatsu CARE)<br>'+
    '• Hrs/Día, Frecuencia PM, Horómetro Actual — datos operativos<br><br>'+
    '<b>Turno / Operador / Ubicación:</b> Estos campos se registran en cada PM y Correctivo para saber en qué contexto ocurrió la intervención.<br><br>'+
    '<div style="padding:8px;background:var(--bg3);border-radius:6px;border-left:3px solid var(--ac)">'+
    '<b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> Tip:</b> Llena la ficha técnica completa de cada equipo. Cuando Komatsu o el proveedor pregunten por el N° de serie o VIN, lo tienes al instante.</div></div></div>'+
    '<div class="card" style="margin-bottom:12px" id="m24"><div class="card-t" style="font-size:16px;margin-bottom:10px">24. KPIs Avanzados</div><div style="font-size:13px;line-height:1.8"><b>6 indicadores avanzados en el Dashboard:</b><br><br><b>Costo/RAV</b> — Costo mantenimiento ÷ Valor del activo × 100. Benchmark: &lt;2%. Si supera 3%, conviene reemplazar.<br><b>Backlog Semanas</b> — HH pendientes ÷ HH disponibles/semana. Rango sano: 2-4 semanas.<br><b>Índice Confiabilidad</b> — Equipos sin falla ÷ Total equipos × 100.<br><b>Disponibilidad Inherente</b> — MTBF ÷ (MTBF + MTTR). Disponibilidad real sin excusas logísticas.<br><b>% Retrabajo</b> — Fallas repetidas en &lt;30 días en mismo equipo/componente. Meta: &lt;5%.<br><b>Criticidad</b> — Crítico (detiene operación) / Esencial (afecta producción) / General (tiene respaldo). Se asigna en Ficha Técnica.</div></div>'+

    // 25. ANÁLISIS DE ACEITE
    '<div class="card" style="margin-bottom:12px" id="m25">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">25. Análisis de Aceite</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Qué hace?</b> Registra y monitorea los resultados de laboratorio (Mobil Assistance / Copec) de cada muestra de aceite tomada a los componentes de la flota: motor, transmisión, mando final, diferencial, sistema hidráulico, tandem, frenos, etc.<br><br>'+
    '<b>▶ Importar muestras desde el laboratorio (CSV)</b><br>'+
    'En la pestaña <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="8"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="6.5" y1="2" x2="13.5" y2="2"/><polygon points="8,8 12,8 16,17 4,17"/><line x1="6" y1="13" x2="14" y2="13"/></svg> Análisis Aceite</b>, click en <b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV</b>. El sistema reconoce automáticamente el formato exportado por el laboratorio Mobil/Copec (columnas como NOMBRE_CLIENTE, EQUIPO, HIERRO, ESTADO, COMENTARIO) — no hace falta reordenar columnas a mano. Marca "Reemplazar todo" solo si quieres limpiar lo cargado antes; si no, suma a lo existente.<br><br>'+
    '<b>▶ Agregar una muestra manual</b><br>'+
    'Botón <b>+ Manual</b> arriba de la tabla. Útil para resultados sueltos que no vienen en CSV.<br><br>'+
    '<b>▶ Estado de cada muestra</b><br>'+
    'Cada muestra trae el <b>ESTADO</b> ya evaluado por el laboratorio: 🟢 <b>NORMAL</b>, 🟡 <b>PRECAUCIÓN</b>, 🔴 <b>ALERTA</b>. Este estado lo define el laboratorio según límites específicos por componente y lubricante (no es un valor genérico) — el sistema respeta ese veredicto, no lo recalcula. Si necesitas corregirlo, se puede editar directo en la columna "Estado <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg>" de la tabla.<br><br>'+
    '<b>▶ Filtros</b><br>'+
    'Puedes filtrar por equipo o por estado usando los selectores sobre la tabla, o haciendo click directo en las tarjetas 🟢🟡🔴 de arriba.<br><br>'+
    '<b>▶ Importante sobre componentes sin identificar</b><br>'+
    'Si una muestra trae "SIN_INFORMACION" en el campo Descriptor, significa que el laboratorio no especificó a qué componente corresponde. El sistema infiere el componente automáticamente solo cuando el lubricante usado es inequívoco (ej. Mobil Delvac Elite = siempre Motor). Cuando el lubricante se usa en más de un componente (ej. Mobiltrans HD 30, que se ha visto tanto en Transmisión como en Mando Final), el sistema lo deja sin completar a propósito — revísalo a mano para no cargar un dato incorrecto.</div></div>'+

    // 26. DASHBOARD — BLOQUES NUEVOS
    '<div class="card" style="margin-bottom:12px" id="m26">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">26. Dashboard — Bloques Nuevos</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    'El Dashboard principal incorpora 3 bloques adicionales a los KPIs originales:<br><br>'+
    '<b>🚨 Tabla de Equipos Urgentes</b> — Lista los equipos con PM vencida o crítica, con horómetro actual, horómetro de próxima PM, días restantes y tipo de PM. Se ordena por urgencia.<br><br>'+
    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Próximos PMs (14 días)</b> — Tarjetas visuales con los equipos que tienen mantención programada en las próximas dos semanas, coloreadas según cercanía (rojo ≤3 días, amarillo 4-14 días).<br><br>'+
    '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Tendencia de Disponibilidad (6 meses)</b> — Gráfico de barras con la disponibilidad mecánica promedio de la flota mes a mes, comparada contra la meta configurada en Config.<br><br>'+
    'Además, dentro de la pestaña <b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="8"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="6.5" y1="2" x2="13.5" y2="2"/><polygon points="8,8 12,8 16,17 4,17"/><line x1="6" y1="13" x2="14" y2="13"/></svg> Análisis Aceite</b> existe un mini-dashboard propio con: torta de Estado General (Normal/Precaución/Alerta), gráfico de muestras mensuales, y rankings por Tipo de Equipo, Tipo de Componente y Lubricante — replicando el formato del reporte oficial de Mobil Assistance, pero calculado en vivo desde tus datos cargados.</div></div>'+

    // 27. VENCIMIENTOS DOCUMENTALES
    '<div class="card" style="margin-bottom:12px" id="m27">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">27. Vencimientos Documentales</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Qué hace?</b> Controla los vencimientos legales y documentales de cada equipo: Revisión Técnica, Permiso de Circulación, Seguro, Sistema AFEX y Decreto 80. La pestaña lee automáticamente la lista de equipos vigente (la misma de la pestaña Equipos) — si agregas un equipo nuevo, aparece aquí solo, sin pasos extra.<br><br>'+
    '<b>▶ Alarma automática</b><br>'+
    'El sistema avisa con <b>1 mes de anticipación</b> antes de cada vencimiento (🟡 Vence en X días). Si ya pasó la fecha, se marca en rojo como 🔴 VENCIDO. Las alertas activas se resumen en una franja roja arriba de la tabla, y aparece un toast al editar un campo que quede dentro de ese rango.<br><br>'+
    '<b>▶ 🟠 "Sin registrar (requerido)" — distinto de "Sin datos"</b><br>'+
    'Cuando el tipo de equipo SÍ exige un documento (hay periodicidad, precargada o ingresada a mano) pero nunca se ha cargado la fecha del último trámite, la fila se marca <b>🟠 Sin registrar (requerido)</b> y SÍ cuenta como alerta y aparece con "Solo con atención" marcado — a diferencia de "Sin datos" (gris), que es para documentos que de verdad no aplican a ese equipo. Un documento exigido que nadie ha cargado nunca es tan o más urgente que uno por vencer en pocos días, así que ya no queda escondido.<br><br>'+
    '<b>▶ Reglas precargadas por tipo de equipo</b><br>'+
    'Según lo confirmado: Camión Aljibe (identificado por sigla: CN-5131, CN-5133 — comparten el mismo "tipo" que los CAEX en la base de datos) y Bus → Revisión Técnica cada 6 meses; Camioneta → Revisión Técnica anual; Aljibe/Camioneta/Bus → Permiso de Circulación anual; Camioneta → Seguro anual; CAEX/Bulldozer/Cargador → Sistema AFEX cada 6 meses; Bus → Decreto 80 cada 4 años. Estas periodicidades se aplican solas al cargar la fecha del último trámite.<br><br>'+
    '<b>▶ Tipos sin regla precargada</b><br>'+
    'Torre de Iluminación, Motoniveladora, Minicargador y Generador no tienen periodicidad confirmada todavía — el sistema NO inventa un valor para estos casos. La celda de Periodicidad queda vacía hasta que la completes a mano.<br><br>'+
    '<b>▶ Todo es editable</b><br>'+
    'Cada celda (Último trámite, Periodicidad en meses, Próximo vencimiento, Observaciones) se edita con un click directo, igual que el resto del sistema. Si cambias el "Último trámite" y existe una periodicidad (precargada o ingresada a mano), el "Próximo vencimiento" se recalcula solo. También puedes escribir la fecha de "Próximo vencimiento" directamente si la conoces, sin pasar por el cálculo automático.<br><br>'+
    '<b>▶ Filtros</b><br>'+
    'Selector por equipo, y casilla "Solo con alerta" para ver de inmediato qué necesita atención esta semana o este mes.</div></div>'+

    // 28. TREN DE RODAJE
    '<div class="card" style="margin-bottom:12px" id="m28">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">28. Tren de Rodaje</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Para qué sirve?</b> Controla el desgaste del tren de rodaje de bulldozers y equipos de orugas: eslabón, buje, zapata, sprocket, rueda guía, rodillo superior y rodillo inferior — cada uno por lado (izquierdo/derecho), igual que Neumáticos pero para orugas en vez de gomas.<br><br>'+
    '<b>▶ Agregar un componente</b><br>'+
    'Botón <b>+ Agregar</b> → elige equipo, componente y lado, e ingresa el <b>valor nuevo</b> (medida de fábrica) y el <b>límite de desgaste</b> (medida mínima antes de reemplazar) — a diferencia de Neumáticos, acá no hay una tabla fija por marca: cada proveedor trae su propia ficha técnica, así que estos dos valores se ingresan a mano por componente.<br><br>'+
    '<b>▶ Registrar una medición</b><br>'+
    'Botón <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="16" height="6" rx="1"/><line x1="5" y1="7" x2="5" y2="9.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><line x1="11" y1="7" x2="11" y2="9.5"/><line x1="14" y1="7" x2="14" y2="9.5"/></svg> junto a cada componente → ingresa el valor actual medido en terreno. El <b>% de vida restante</b> se recalcula solo: (valor actual − límite de desgaste) ÷ (valor nuevo − límite de desgaste).<br><br>'+
    '<b>▶ Ver historial</b><br>'+
    'Botón <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg> muestra todas las mediciones anteriores de ese componente, para ver la tendencia de desgaste en el tiempo.</div></div>'+

    // 29. SENSORES DE NEUMÁTICOS
    '<div class="card" style="margin-bottom:12px" id="m29">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">29. Sensores de Neumáticos</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Para qué sirve?</b> Sigue la pista al sensor de presión FÍSICO, por separado del neumático — el mismo sensor a veces se reutiliza en OTRO neumático cuando este se cambia, así que necesita su propia historia (marca, dónde está instalado, en qué neumático estuvo antes).<br><br>'+
    '<b>▶ ¿Cómo se accede?</b><br>'+
    'Botón <b>Sensores</b> arriba de la tabla, en la pestaña <b>Neumáticos</b>.<br><br>'+
    '<b>▶ Instalar / desmontar</b><br>'+
    'Desde el listado de sensores, cada uno se puede <b>instalar</b> en un neumático (queda enlazado a su número de serie) o <b>desmontar</b> (queda libre, disponible para instalarse en otro neumático más adelante). Si el neumático donde estaba instalado ya tenía otro sensor, el sistema lo desmonta solo primero — un neumático no puede tener dos sensores enlazados a la vez.<br><br>'+
    '<b>▶ Historial</b><br>'+
    'Cada sensor guarda en qué neumáticos ha estado instalado y cuándo, para poder rastrear su vida útil aunque cambie de goma varias veces.</div></div>'+

    // 30. PROGRAMACIÓN DIARIA
    '<div class="card" style="margin-bottom:12px" id="m30">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">30. Programación Diaria</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Qué es, y en qué se diferencia del Programa Anual/Gantt?</b> Esos dos son por EQUIPO y por MES (cuándo toca cada PM). Programación Diaria es por PERSONA y por DÍA: quién trabajó, en qué turno (día/noche) y en qué bloques de 30 minutos — el dato que arma el supervisor de terreno cada jornada.<br><br>'+
    '<b>▶ Importar el Excel de terreno</b><br>'+
    'Botón <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar Excel → sube el archivo tal como lo llena el supervisor. El sistema reconoce solo las hojas que tengan el formato esperado (con su fila "Fecha:") y detecta automáticamente cuántos turnos hay marcados en la hoja (no asume que son siempre solo día y noche).<br><br>'+
    '<b>▶ Dos vistas</b><br>'+
    '<b>Detalle</b> — cada persona, cada bloque de 30 min, qué estaba haciendo.<br>'+
    '<b>Resumen</b> — utilización de la dotación total, sin contar como trabajo productivo la charla de seguridad, colación ni vacaciones.</div></div>'+

    // 31. VERIFICACIÓN EN DOS PASOS Y SEGURIDAD DE LA CUENTA
    '<div class="card" style="margin-bottom:12px" id="m31">'+
    '<div class="card-t" style="font-size:16px;margin-bottom:10px">31. Verificación en Dos Pasos y Seguridad de la Cuenta</div>'+
    '<div style="font-size:13px;line-height:1.8">'+
    '<b>¿Qué es?</b> Un candado extra en <b>Configuración</b>: además de tu correo y contraseña, pide un código de 6 dígitos que cambia cada 30 segundos (con una app tipo Google Authenticator en tu teléfono). Así, aunque alguien consiga tu contraseña, no puede entrar sin tu teléfono.<br><br>'+
    '<b>▶ Activarla</b><br>'+
    'En Configuración → tarjeta "Verificación en dos pasos" → botón <b>Activar</b>. Escanea el código QR con tu app de autenticación (o ingresa el código manual si no puedes escanear) y escribe el código de 6 dígitos que te muestre para confirmar. Desde ese momento, cada inicio de sesión pide ese código además de tu clave.<br><br>'+
    '<b>▶ Desactivarla</b><br>'+
    'Mismo lugar → botón <b>Desactivar</b>. Vuelve a bastar con la clave sola.<br><br>'+
    '<b>▶ Otras dos herramientas de seguridad, en la misma pestaña</b><br>'+
    '<b>Accesos recientes</b> — quién entró al sistema, cuándo, y desde qué computador (útil si algo no se guardó y quieres saber si fue por una sesión vencida en otro equipo).<br>'+
    '<b>Log de cambios</b> — auditoría de cada edición, creación o eliminación en el sistema, con fecha, usuario y detalle — no solo los inicios de sesión.</div></div>';
};
