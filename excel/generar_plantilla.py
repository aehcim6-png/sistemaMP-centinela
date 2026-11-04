"""Genera SistemaMP_Excel_base.xlsx: la hoja «Conexión» con las celdas con nombre que usan
el módulo VBA (modSistemaMP) y las consultas Power Query (fnSupabase).

Uso: python3 excel/generar_plantilla.py [salida.xlsx]
No guarda contraseñas ni tokens: solo la URL del proyecto y su clave pública (la misma de la web).
"""
import sys
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.workbook.defined_name import DefinedName

URL = "https://jyhpfwivhwzylkzxrsbt.supabase.co"
KEY_PUBLICA = "sb_publishable_mI_CTe7yV23tllXXkdp-Aw_2UZCtwbi"   # misma que modules/store.js (_SB_DEFAULT_KEY)

salida = sys.argv[1] if len(sys.argv) > 1 else "SistemaMP_Excel_base.xlsx"
AZUL, GRIS, COBRE = "2F4F8F", "5B6B64", "9A5225"
fino = Side(style="thin", color="D6DBD8")

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Conexión"
ws.sheet_view.showGridLines = False
ws.column_dimensions["A"].width = 3
ws.column_dimensions["B"].width = 26
ws.column_dimensions["C"].width = 60
ws.column_dimensions["E"].width = 70

ws["B2"] = "SistemaMP · conexión"
ws["B2"].font = Font(bold=True, size=18, color=AZUL)
ws["B3"] = "Este Excel lee los datos directamente de SistemaMP. Entra con tu mismo usuario del programa."
ws["B3"].font = Font(italic=True, color=GRIS)

filas = [
    ("SB_URL", "Servidor", URL, "No cambiar."),
    ("SB_KEY", "Clave pública", KEY_PUBLICA, "Clave pública del proyecto (la misma de la web). Nunca pongas aquí la clave service_role."),
    ("SB_EMAIL", "Tu correo de SistemaMP", "", "Escríbelo una vez. La contraseña NO se guarda: se pide al Conectar."),
    ("SB_ESTADO", "Estado", "No conectado", "Lo actualiza el botón Conectar."),
    ("SB_ULTIMA", "Última actualización", "", ""),
    ("SB_EXPIRA", "Sesión válida hasta", "", "La sesión dura ~1 hora; Actualizar la renueva sola."),
    ("SB_TOKEN", "Token de sesión (interno)", "", "Lo llena Conectar y se borra al cerrar el libro. No lo copies ni lo compartas."),
]
for i, (nombre, etiqueta, valor, ayuda) in enumerate(filas, start=5):
    ws.cell(i, 2, etiqueta).font = Font(bold=True, color=GRIS)
    c = ws.cell(i, 3, valor)
    c.border = Border(left=fino, right=fino, top=fino, bottom=fino)
    c.alignment = Alignment(shrink_to_fit=True)
    if nombre == "SB_EMAIL":
        c.fill = PatternFill("solid", fgColor="FFF8E7")
    if nombre in ("SB_ULTIMA", "SB_EXPIRA"):
        c.number_format = "dd-mm-yyyy hh:mm"
    if nombre == "SB_TOKEN":
        c.font = Font(color="BFBFBF", size=8)
    ws.cell(i, 5, ayuda).font = Font(size=9, color=GRIS)
    wb.defined_names[nombre] = DefinedName(nombre, attr_text=f"'Conexión'!$C${i}")

ws["B14"] = "Botones (créalos una vez y asígnales la macro):"
ws["B14"].font = Font(bold=True, color=COBRE)
for k, (txt, macro) in enumerate([("Conectar", "Conectar"), ("Actualizar", "Actualizar"), ("Desconectar", "Desconectar")], start=15):
    ws.cell(k, 2, f"[ {txt} ]").font = Font(bold=True, color=AZUL)
    ws.cell(k, 3, f"Insertar → Formas → rectángulo «{txt}» → clic derecho → Asignar macro → {macro}").font = Font(size=9, color=GRIS)
ws["B19"] = "Guía completa: carpeta excel/ del repositorio (README.md)."
ws["B19"].font = Font(size=9, italic=True, color=GRIS)

wd = wb.create_sheet("Dashboard")
wd.sheet_view.showGridLines = False
wd["B2"] = "Dashboard SistemaMP"
wd["B2"].font = Font(bold=True, size=18, color=AZUL)
wd["B3"] = "Aquí van las tablas dinámicas del Modelo de datos (ver README, paso 5)."
wd["B3"].font = Font(italic=True, color=GRIS)

wb.active = 0
wb.save(salida)
print("ok:", salida)
