const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Importador de aceite: el Excel del portal Mobil Assistance (EQUIPO = tipo, COMPONENTE = código propio) se traduce a sigla + componente,
// no repite muestras ya cargadas y avisa de lo que no puede resolver. Antes dejaba «CAMION» como equipo de todas las filas.
test('el Excel de Mobil Assistance se importa con la sigla y el componente correctos', async ({ page }) => {
  test.setTimeout(90000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    S.s('eq', [{ sigla: 'CN-9501', tipo: 'Camion', modelo: 'X', horomActual: 1000, frecPM: 250 }, { sigla: 'CF-8769', tipo: 'Cargador', modelo: 'X', horomActual: 2000, frecPM: 250 }]);
    await esp(800);
    const cab = ['NOMBRE_CLIENTE', 'NOMBRE_FAENA', 'N_MUESTRA', 'FECHA_MUESTREO', 'LUBRICANTE', 'EQUIPO', 'MARCA_EQUIPO', 'MODELO_EQUIPO', 'EQUIPO_ID', 'COMPONENTE', 'DESCRIPTOR_COMPONENTE', 'HIERRO', 'ESTADO', 'COMENTARIO'];
    const filas = [
      ['BESALCO', 'CENTINELA', '3026001907', '10-01-2026', 'MOBILTRANS HD 30', 'OTRO', 'SIN_INFORMACION', 'SIN_INFORMACION', '', 'CE-86MFI', 'MANDO FINAL', '40', 'PRECAUCION', 'repetida en el archivo'],
      ['BESALCO', 'CENTINELA', '3026001907', '10-01-2026', 'MOBILTRANS HD 30', 'OTRO', 'SIN_INFORMACION', 'SIN_INFORMACION', '', 'CE-86MFI', 'MANDO FINAL', '40', 'PRECAUCION', 'nueva'],
      ['BESALCO', 'CENTINELA', '3026042321', '10-10-2026', 'MOBIL DELVAC EXTENDED LIFE C 50%', 'CARGADOR', 'SIN_INFORMACION', 'SIN_INFORMACION', '', 'CF-769REF', 'SIN_INFORMACION', '1', 'NORMAL', 'refrigerante'],
      ['BESALCO', 'CENTINELA', '3026042292', '25-10-2026', 'MOBILTRANS HD 30', 'CAMION', 'KOMATSU', 'SIN_INFORMACION', '', 'TM', 'SIN_INFORMACION', '7', 'ALERTA', 'sin equipo'],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab].concat(filas)), 'Sheet');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    importAceite();
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'muestras.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    document.getElementById('aceFile').files = dt.files;
    processAceCSV();
    for (let k = 0; k < 30; k++) { await esp(200); if ((S.g('aceite') || []).length > 1) break; }
    await esp(300);
    return { ace: S.g('aceite').map((m) => [m.nMuestra, m.equipo, m.sigla || '', m.componente, m.descriptor || '', m.estado]), modal: document.getElementById('mc') ? document.getElementById('mc').innerText : '' };
  });
  expect(r.ace).toEqual([
    ['3026001907', 'CN-9501', 'CN-9501', 'MANDO FINAL IZQ', 'MANDO FINAL', 'PRECAUCION'],
    ['3026042321', 'CF-8769', 'CF-8769', 'REFRIGERANTE', '', 'NORMAL'],
  ]);
  expect(r.modal).toContain('1 ya estaban');      // la muestra repetida no se carga dos veces
  expect(r.modal).toContain('NO se cargaron');   // la fila con código «TM» suelto no se adivina
  expect(r.modal).toContain('3026042292');
});
