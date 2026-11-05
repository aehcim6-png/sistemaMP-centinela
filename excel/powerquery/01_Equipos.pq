// Equipos — la ficha y el estado de PM tal como los calcula SistemaMP (el Excel no recalcula: muestra lo mismo que el programa).
let
    Origen = fnSupabase(
        "equipos",
        "sigla,tipo,modelo,unidad,criticidad,frecPM,hrsDia,horomActual,fechaHorom,tipoPM,horomProxPM,hrsRestantes,diasParaPM,fechaProxPM,estado",
        "sigla.asc"),
    Tipos = Table.TransformColumnTypes(Origen, {
        {"sigla", type text}, {"tipo", type text}, {"modelo", type text}, {"unidad", type text}, {"criticidad", type text},
        {"frecPM", type number}, {"hrsDia", type number}, {"horomActual", type number}, {"fechaHorom", type date},
        {"tipoPM", type text}, {"horomProxPM", type number}, {"hrsRestantes", type number}, {"diasParaPM", Int64.Type},
        {"fechaProxPM", type date}, {"estado", type text}}, "en-US"),
    // El programa guarda el estado con emoji ("🔴 URGENTE"); aquí queda una palabra limpia para filtrar y contar.
    EstadoPM = Table.AddColumn(Tipos, "EstadoPM", each
        let t = Text.Upper(Text.From([estado] ?? "")) in
            if Text.Contains(t, "VENCID") then "Vencida"
            else if Text.Contains(t, "URGENTE") then "Urgente"
            else if Text.Contains(t, "PRÓXIMA") or Text.Contains(t, "PROXIMA") then "Próxima"
            else if Text.Contains(t, "AL DÍA") or Text.Contains(t, "AL DIA") then "Al día"
            else if Text.Contains(t, "SIN LECTURA") then "Sin lectura"
            else "Sin dato", type text),
    Unidad = Table.TransformColumns(EstadoPM, {{"unidad", each if _ = null or _ = "" or _ = "hr" then "h" else _, type text}}),
    Orden = Table.AddColumn(Unidad, "OrdenEstado", each
        if [EstadoPM] = "Vencida" then 1 else if [EstadoPM] = "Urgente" then 2 else if [EstadoPM] = "Próxima" then 3
        else if [EstadoPM] = "Al día" then 4 else 5, Int64.Type)
in
    Orden
