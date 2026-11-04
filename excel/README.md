# SistemaMP en Excel — Etapa 1 (solo lectura)

Un Excel conectado **a la misma base de datos que SistemaMP** (Supabase, proyecto Centinela). No es una copia: cada vez que se presiona **Actualizar** trae lo que hay en el programa. Así el programa y el Excel nunca se contradicen.

```
  SistemaMP (web) ──► Supabase ◄── Excel: VBA (iniciar sesión) + Power Query (traer datos)
                                         + Power Pivot / DAX (indicadores) + tablas dinámicas (dashboard)
```

- **Etapa 1 (esta):** leer y analizar. El Excel **no escribe** nada en la base.
- Etapa 2 (después): formularios VBA para anotar PM, horómetros, detenciones y OT desde el Excel.

## Requisitos

- Excel de escritorio para **Windows** (Microsoft 365, o 2019/2021). VBA no funciona en Excel Online ni en el celular, y en Mac falta MSXML2.
- Un **usuario de SistemaMP** (el mismo correo y contraseña). El Excel ve exactamente lo que esa persona ve en el programa: los permisos los aplica la base de datos.

## Seguridad

- En el Excel solo va la **clave pública** del proyecto (`sb_publishable_…`, la misma que ya usa la web). **Nunca** pongas la clave `service_role`.
- La contraseña **no se guarda**: se usa una vez para pedir un token de sesión (~1 hora). El token se borra al cerrar el libro. El token para renovarla vive solo en memoria.
- Los datos que trae Power Query **sí quedan guardados en el archivo** (como cualquier Excel con datos). Trátalo como información interna de la faena.

## Cómo armarlo (una vez, ~30 minutos)

### 1. Libro base
Abre `SistemaMP_Excel_base.xlsx` (lo genera `generar_plantilla.py`) y guárdalo como **Libro de Excel habilitado para macros (.xlsm)**.
La hoja **Conexión** ya trae las celdas con nombre: `SB_URL`, `SB_KEY`, `SB_EMAIL`, `SB_TOKEN`, `SB_EXPIRA`, `SB_ULTIMA`, `SB_ESTADO`.

### 2. VBA
1. `Alt+F11` → Archivo → **Importar archivo…** → `vba/modSistemaMP.bas`.
2. Doble clic en **ThisWorkbook** → pega el contenido de `vba/ThisWorkbook.txt`.
3. (Recomendado) Crea el formulario `frmLogin` siguiendo `vba/frmLogin.txt`: la contraseña se escribe con asteriscos. Sin él, se pide con un cuadro que la muestra.
4. En la hoja Conexión: Insertar → Formas → 3 rectángulos «Conectar», «Actualizar», «Desconectar» → clic derecho → **Asignar macro** → `Conectar`, `Actualizar`, `Desconectar`.

### 3. Power Query (traer los datos)
1. Datos → Obtener datos → Otras fuentes → **Consulta en blanco**. En el Editor avanzado pega `powerquery/00_fnSupabase.pq` y nombra la consulta **fnSupabase**.
2. Repite para cada archivo, con estos nombres exactos: **Equipos**, **RegistrosPM**, **Horometros**, **Correctivos**, **Reportabilidad**, **Calendario**.
3. Archivo → Opciones y configuración → Opciones de consulta → **Libro actual → Privacidad → «Ignorar los niveles de privacidad»**. Sin esto, Excel bloquea la combinación «celda del libro + web» (error *Formula.Firewall*).
4. Cerrar y cargar en… → **Crear solo conexión** y marcar **Agregar estos datos al Modelo de datos** (para las 6 consultas; `fnSupabase` solo conexión).
5. La primera vez Excel puede preguntar cómo autenticarse en la web: elige **Anónimo** (la autenticación la manda la consulta en el encabezado).

### 4. Modelo de datos (Power Pivot)
1. Datos → **Administrar modelo de datos** → Vista de diagrama → crea las relaciones que dice el inicio de `dax/medidas.dax`.
2. Marca **Calendario** como tabla de fechas (Diseño → Marcar como tabla de fechas → columna Fecha).
3. Crea las medidas de `dax/medidas.dax` (en la tabla que quieras; se recomienda una tabla «Medidas» vacía o la de Equipos).

### 5. Dashboard
Insertar → **Tabla dinámica** → «Usar el modelo de datos de este libro». Ideas para la primera hoja:

| Bloque | Filas / columnas | Valores | Segmentación |
|---|---|---|---|
| Indicadores | — | PM urgentes, PM próximas, PM al día, F/S hoy, % Disponibilidad, % Cumplimiento PM | Calendario[Año], Calendario[Mes] |
| Flota | Equipos[sigla], Equipos[tipoPM], Equipos[EstadoPM] | Equipos[diasParaPM], Equipos[hrsRestantes] | Equipos[tipo] |
| Cumplimiento | Calendario[AñoMes] | PM ejecutadas, % Cumplimiento PM | Equipos[tipo] |
| Disponibilidad | Calendario[AñoMes] × Equipos[sigla] | % Disponibilidad | Calendario[Año] |
| OT por sistema | Correctivos[sistema] | OT, Horas OT | Calendario[Mes], Equipos[tipo] |

Formato condicional en EstadoPM (rojo Vencida/Urgente, ámbar Próxima, verde Al día) y gráficos dinámicos a partir de esas tablas.

### 6. Uso diario
**Conectar** (una vez por sesión) → **Actualizar** cuando se quiera ver lo último. Si sale *401*, la sesión venció: **Conectar** otra vez.

## Notas sobre los datos (vistas al armar esto, 04-11-2026)

- `registros_pm`: ~45 % de los registros no tiene `fechaEjec`; la consulta usa la de salida o entrada. En `estado` hay valores con emoji y 7 con un ícono HTML guardado por error: se normalizan a «Anticipada / A tiempo / …».
- `correctivos.duracion` es texto («1h 30min»); se convierte a horas. Hay 27 valores con un carácter mal codificado («â€”») que quedan en blanco.
- CN-4656, CN-6113 y CN-9506 tienen historial pero ya no están en `equipos`.
- Supabase entrega 1.000 filas por pedido; `fnSupabase` pide de a páginas, así que trae todo.

## Archivos

| Archivo | Qué es |
|---|---|
| `powerquery/*.pq` | Consultas Power Query (lenguaje M) |
| `vba/modSistemaMP.bas` | Iniciar sesión, actualizar, desconectar |
| `vba/ThisWorkbook.txt`, `vba/frmLogin.txt` | Código para pegar en el libro y en el formulario |
| `dax/medidas.dax` | Relaciones y medidas del Modelo de datos |
| `generar_plantilla.py` | Genera `SistemaMP_Excel_base.xlsx` (hoja Conexión con las celdas con nombre) |
