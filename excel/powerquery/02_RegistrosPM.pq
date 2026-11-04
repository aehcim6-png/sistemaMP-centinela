// RegistrosPM — cada PM ejecutada registrada en SistemaMP.
let
    Origen = fnSupabase(
        "registros_pm",
        "id,equipo,tipoPM,fechaEjec,fechaEntrada,fechaSalida,horomReal,estado,tecnico,duracionH,desvioDias,pmCompleto,lugar,obs",
        "id.asc"),
    Tipos = Table.TransformColumnTypes(Origen, {
        {"equipo", type text}, {"tipoPM", type text}, {"fechaEjec", type date}, {"fechaEntrada", type date},
        {"fechaSalida", type date}, {"horomReal", type number}, {"estado", type text}, {"tecnico", type text},
        {"duracionH", type number}, {"desvioDias", type number}, {"pmCompleto", type logical}, {"lugar", type text}, {"obs", type text}}, "en-US"),
    // Fecha del PM: la de ejecución; si falta (pasa en ~45 % de los registros), la de salida o la de entrada.
    Fecha = Table.AddColumn(Tipos, "Fecha", each [fechaEjec] ?? [fechaSalida] ?? [fechaEntrada], type date),
    // Cumplimiento con una palabra limpia (en la base hay variantes con emoji y algunas con un ícono HTML guardado por error).
    Cumplimiento = Table.AddColumn(Fecha, "Cumplimiento", each
        let t = Text.Upper(Text.From([estado] ?? "")) in
            if Text.Contains(t, "ANTICIPAD") then "Anticipada"
            else if Text.Contains(t, "A TIEMPO") or Text.Contains(t, "EN FECHA") then "A tiempo"
            else if Text.Contains(t, "LEVE") then "Leve atraso"
            else if Text.Contains(t, "ATRAS") then "Atrasada"
            else "Sin dato", type text),
    Sigla = Table.RenameColumns(Cumplimiento, {{"equipo", "sigla"}})
in
    Sigla
