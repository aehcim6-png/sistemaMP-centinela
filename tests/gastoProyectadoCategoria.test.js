const { _gastoProyectadoCategoria } = require('../logic.js');

describe('_gastoProyectadoCategoria', () => {
  it('devuelve una estructura vacía y coherente para un arreglo vacío', () => {
    const res = _gastoProyectadoCategoria([], () => [], () => 0, 'mes');
    expect(res.itemsConDatos).toBe(0);
    expect(res.itemsSinDatos).toBe(0);
    expect(res.itemsSinPrecio).toBe(0);
    expect(res.gastoHastaFinAnio).toBe(0);
    expect(res.periodosOrd.length).toBe(12);
  });

  it('excluye del total un ítem con historial pero sin precio, y lo cuenta aparte', () => {
    const items = [{ id: 1 }];
    const res = _gastoProyectadoCategoria(
      items,
      () => [{ fecha: '2024-01-15', cant: 5 }],
      () => 0,
      'mes'
    );
    expect(res.itemsSinPrecio).toBe(1);
    expect(res.itemsConDatos).toBe(0);
    expect(res.gastoHastaFinAnio).toBe(0);
  });

  it('excluye del total un ítem sin ningún historial de eventos', () => {
    const items = [{ id: 1 }];
    const res = _gastoProyectadoCategoria(items, () => [], () => 1000, 'mes');
    expect(res.itemsSinDatos).toBe(1);
    expect(res.itemsConDatos).toBe(0);
  });

  it('calcula el gasto proyectado como promedio móvil de los últimos 6 meses × precio', () => {
    const eventos = [
      { fecha: '2024-01-10', cant: 10 },
      { fecha: '2024-02-10', cant: 20 },
    ];
    const res = _gastoProyectadoCategoria([{ id: 1 }], () => eventos, () => 100, 'mes');
    expect(res.itemsConDatos).toBe(1);
    // promedio móvil = (10+20)/2 = 15 unidades/mes × $100 = $1500/mes proyectado
    const primerPeriodo = res.periodosOrd[0];
    expect(res.porPeriodo[primerPeriodo]).toBe(1500);
  });

  it('usa solo los últimos 6 meses con datos para el promedio móvil, no todo el historial', () => {
    const eventos = [
      { fecha: '2020-01-10', cant: 1000 }, // muy viejo, no debe entrar al promedio
      { fecha: '2024-01-10', cant: 10 },
      { fecha: '2024-02-10', cant: 10 },
      { fecha: '2024-03-10', cant: 10 },
      { fecha: '2024-04-10', cant: 10 },
      { fecha: '2024-05-10', cant: 10 },
      { fecha: '2024-06-10', cant: 10 },
    ];
    const res = _gastoProyectadoCategoria([{ id: 1 }], () => eventos, () => 10, 'mes');
    const primerPeriodo = res.periodosOrd[0];
    // promedio móvil de los últimos 6 meses reales = 10 unidades/mes × $10 = $100/mes
    expect(res.porPeriodo[primerPeriodo]).toBe(100);
  });

  it('agrupa correctamente por semestre y por año', () => {
    const eventos = [{ fecha: '2024-01-10', cant: 12 }];
    const resMes = _gastoProyectadoCategoria([{ id: 1 }], () => eventos, () => 10, 'mes');
    const resSem = _gastoProyectadoCategoria([{ id: 1 }], () => eventos, () => 10, 'semestre');
    const resAnio = _gastoProyectadoCategoria([{ id: 1 }], () => eventos, () => 10, 'año');
    // el total hasta fin de año debe ser el mismo sin importar cómo se agrupe para mostrarlo
    expect(resSem.gastoHastaFinAnio).toBe(resMes.gastoHastaFinAnio);
    expect(resAnio.gastoHastaFinAnio).toBe(resMes.gastoHastaFinAnio);
    // las claves de período deben tener el formato esperado
    expect(resSem.periodosOrd.every((p) => /^\d{4}-S[12]$/.test(p))).toBe(true);
    expect(resAnio.periodosOrd.every((p) => /^\d{4}$/.test(p))).toBe(true);
  });

  it('suma el gasto de varios ítems de la misma categoría', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const res = _gastoProyectadoCategoria(
      items,
      (item) => [{ fecha: '2024-01-10', cant: 10 }],
      () => 50,
      'mes'
    );
    expect(res.itemsConDatos).toBe(2);
    const primerPeriodo = res.periodosOrd[0];
    // cada ítem aporta 10×$50=$500/mes → $1000/mes entre los dos
    expect(res.porPeriodo[primerPeriodo]).toBe(1000);
  });
});
