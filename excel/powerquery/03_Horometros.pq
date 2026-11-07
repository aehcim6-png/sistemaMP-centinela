// Horometros — todas las lecturas de horómetro / kilometraje.
let
    Origen = fnSupabase("historial_horometros", "id,sigla,fecha,horom,origen", "id.asc"),
    Tipos = Table.TransformColumnTypes(Origen, {{"sigla", type text}, {"fecha", type date}, {"horom", type number}, {"origen", type text}}, "en-US")
in
    Tipos
