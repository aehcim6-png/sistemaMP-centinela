// Reportabilidad — una fila por equipo y por día (el reporte diario del cliente que se importa en SistemaMP).
let
    Origen = fnSupabase(
        "reportabilidad_diaria",
        "id,fecha,sigla,siglaCliente,estatus,ubicacion,detalle,fechaDetencion,proyeccion,ordenCompra,observacion",
        "id.asc"),
    Tipos = Table.TransformColumnTypes(Origen, {
        {"fecha", type date}, {"sigla", type text}, {"siglaCliente", type text}, {"estatus", type text}, {"ubicacion", type text},
        {"detalle", type text}, {"fechaDetencion", type date}, {"proyeccion", type date}, {"ordenCompra", type text}, {"observacion", type text}}, "en-US"),
    FS = Table.AddColumn(Tipos, "EsFS", each Text.Upper(Text.From([estatus] ?? "")) = "FS", type logical),
    DiasFS = Table.AddColumn(FS, "DiasFS", each if [EsFS] and [fechaDetencion] <> null then Duration.Days([fecha] - [fechaDetencion]) else null, Int64.Type)
in
    DiasFS
