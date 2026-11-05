// fnSupabase — trae una tabla completa de SistemaMP (Supabase) de a 1.000 filas (límite del servidor).
// Lee la conexión desde 3 celdas con nombre del libro: SB_URL, SB_KEY y SB_TOKEN (el token lo pone el botón «Conectar», VBA).
// Uso: fnSupabase("equipos", "sigla,tipo,modelo", "sigla.asc")
//      fnSupabase("correctivos", "id,sigla,fecha", "id.asc", [fecha = "gte.2025-01-01"])   // filtro opcional (sintaxis PostgREST)
(tabla as text, columnas as text, orden as text, optional filtros as nullable record) as table =>
let
    Celda = (nombre as text) as text =>
        let v = try Excel.CurrentWorkbook(){[Name = nombre]}[Content]{0}[Column1] otherwise null
        in if v = null or Text.From(v) = "" then error Error.Record("SistemaMP", "Falta la celda con nombre " & nombre & ". Presiona «Conectar» en la hoja Conexión.") else Text.From(v),
    Url = Celda("SB_URL"),
    Clave = Celda("SB_KEY"),
    Token = Celda("SB_TOKEN"),
    Pagina = 1000,
    Base = [select = columnas, order = orden, limit = Text.From(Pagina)],
    Consulta = if filtros = null then Base else Base & filtros,
    Traer = (desde as number) as list =>
        let
            Resp = Web.Contents(Url, [
                RelativePath = "rest/v1/" & tabla,
                Query = Consulta & [offset = Text.From(desde)],
                Headers = [apikey = Clave, Authorization = "Bearer " & Token, Accept = "application/json"],
                ManualStatusHandling = {400, 401, 403, 404, 500}
            ]),
            Estado = Value.Metadata(Resp)[Response.Status],
            Datos =
                if Estado = 200 then Json.Document(Resp)
                else error Error.Record(
                    "SistemaMP",
                    "Error " & Text.From(Estado) & " al leer «" & tabla & "»" &
                        (if Estado = 401 then ": la sesión venció o no es válida. Presiona «Conectar» otra vez." else "."),
                    Text.FromBinary(Resp))
        in
            Datos,
    Paginas = List.Generate(
        () => [desde = 0, filas = Traer(0)],
        each List.Count([filas]) > 0,
        each if List.Count([filas]) < Pagina
             then [desde = [desde], filas = {}]
             else [desde = [desde] + Pagina, filas = Traer([desde] + Pagina)],
        each [filas]),
    Filas = List.Combine(Paginas),
    Nombres = List.Transform(Text.Split(columnas, ","), Text.Trim),
    Tabla = Table.FromRecords(Filas, Nombres, MissingField.UseNull)
in
    Tabla
