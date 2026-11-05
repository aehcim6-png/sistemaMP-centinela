// Correctivos — las OT registradas en SistemaMP.
let
    Origen = fnSupabase(
        "correctivos",
        "id,sigla,tipo,fecha,horom,sistema,componente,sintoma,solucion,causaRaiz,tecnico,duracion,estadoOT,criticidad,ubicacion,fechaEntrada,fechaSalida,fechaCierre,costo",
        "id.asc"),
    Tipos = Table.TransformColumnTypes(Origen, {
        {"sigla", type text}, {"tipo", type text}, {"fecha", type date}, {"horom", type number}, {"sistema", type text},
        {"componente", type text}, {"sintoma", type text}, {"solucion", type text}, {"causaRaiz", type text},
        {"tecnico", type text}, {"duracion", type text}, {"estadoOT", type text}, {"criticidad", type text},
        {"ubicacion", type text}, {"fechaEntrada", type date}, {"fechaSalida", type date}, {"fechaCierre", type date}, {"costo", type number}}, "en-US"),
    // "1h 30min" -> 1,5 horas. Valores vacíos o raros (ej. "—") quedan en blanco, no en cero.
    Horas = Table.AddColumn(Tipos, "DuracionH", each
        let
            t = Text.Lower(Text.From([duracion] ?? "")),
            h = try Number.From(Text.BeforeDelimiter(t, "h")) otherwise null,
            m = try Number.From(Text.Trim(Text.BetweenDelimiters(t, "h", "min"))) otherwise 0
        in
            if h = null then null else h + m / 60, type number)
in
    Horas
