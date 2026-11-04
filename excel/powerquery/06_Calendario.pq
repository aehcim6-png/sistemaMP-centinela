// Calendario — tabla de fechas para el Modelo de datos (desde el dato más antiguo hasta fin del año actual).
let
    Inicio = #date(2025, 1, 1),
    Fin = #date(Date.Year(DateTime.Date(DateTime.LocalNow())), 12, 31),
    Fechas = List.Dates(Inicio, Duration.Days(Fin - Inicio) + 1, #duration(1, 0, 0, 0)),
    Tabla = Table.FromList(Fechas, Splitter.SplitByNothing(), {"Fecha"}),
    Tipo = Table.TransformColumnTypes(Tabla, {{"Fecha", type date}}),
    Año = Table.AddColumn(Tipo, "Año", each Date.Year([Fecha]), Int64.Type),
    MesN = Table.AddColumn(Año, "MesNum", each Date.Month([Fecha]), Int64.Type),
    Mes = Table.AddColumn(MesN, "Mes", each {"Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"}{[MesNum] - 1}, type text),
    AñoMes = Table.AddColumn(Mes, "AñoMes", each Text.From([Año]) & "-" & Text.PadStart(Text.From([MesNum]), 2, "0"), type text),
    // Semana de faena: jueves a miércoles (como los programas semanales). Se numera por el jueves que la inicia.
    InicioSemana = Table.AddColumn(AñoMes, "InicioSemana", each Date.AddDays([Fecha], -Number.Mod(Date.DayOfWeek([Fecha], Day.Monday) - 3 + 7, 7)), type date)
in
    InicioSemana
