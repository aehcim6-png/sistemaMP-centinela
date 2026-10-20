#!/usr/bin/env python3
"""Genera docs/manual-usuario.html a partir de docs/manual-usuario.md (misma plantilla visual que ya tiene el HTML).
Uso: python3 scripts/manual_md_a_html.py [carpeta_repo] [docs/otro.md docs/otro.html "Título"]
Con los tres argumentos finales genera otro documento con la misma plantilla (por ejemplo el inventario de algoritmos).
Soporta lo que usa el manual: títulos, citas (cuadro destacado), tablas, listas con y sin número, párrafos, negrita, cursiva, código y enlaces [texto](https://…)."""
import html, re, sys

MANUAL_CSS = '''
  /* Ronda 4D */
  html{scroll-behavior:smooth}
  body{padding:clamp(24px,5vw,56px) 20px 80px}
  .wrap{max-width:1120px}
  .doc-layout{display:grid;grid-template-columns:minmax(0,760px) 220px;gap:32px;align-items:start}
  .doc-index{position:sticky;top:20px;max-height:calc(100vh - 40px);overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}
  .doc-index summary{cursor:pointer;font-weight:700;color:var(--ink);margin-bottom:10px}
  .doc-index a{display:block;color:var(--ink-dim);text-decoration:none;font-size:13px;line-height:1.4;padding:5px 7px;border-radius:4px}
  .doc-index a:hover,.doc-index a:focus{color:var(--amber);background:var(--panel2)}
  .doc-index a.active{color:var(--amber);font-weight:700;background:var(--panel2)}
  .doc-main{min-width:0}
  h2,h3{scroll-margin-top:24px;text-wrap:balance}
  p,li{font-size:16px;line-height:1.6}
  p,ul,ol{max-width:75ch}
  .table-scroll{max-width:100%;overflow-x:auto;margin:16px 0}
  table{min-width:620px;margin:0}
  th{background:var(--panel2);color:var(--ink);position:sticky;top:0}
  pre{max-width:100%;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
  .back-top{position:fixed;right:18px;bottom:18px;background:var(--amber);color:var(--bg);border:0;border-radius:999px;padding:9px 12px;font-weight:700;text-decoration:none}
  @media(max-width:800px){.doc-layout{display:block}.doc-index{position:sticky;top:8px;z-index:5;max-height:none;margin-bottom:20px}.doc-index:not([open]){padding-bottom:10px}}
  @media print{body{background:#fff;color:#111;padding:0}.doc-index,.back-top{display:none}.doc-layout{display:block}.wrap{max-width:none}p,li{color:#222}h2{break-before:auto;break-after:avoid}.callout{color:#222;border-color:#777;background:#f5f5f5;break-inside:avoid}table{font-size:10pt}a{color:#111;text-decoration:none}}
'''

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\[([^\]]+)\]\((https?://[^)\s]+)\)', r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<i>\1</i>', t)
    return t

def convertir(md):
    out, lines, i = [], md.split('\n'), 0
    def parrafo(buf):
        if not buf: return
        txt = ' '.join(s.strip() for s in buf)
        m = re.match(r'^\*\*(.+?)\*\*$', buf[0].strip())
        if m and len(buf) > 1:
            resto = ' '.join(s.strip() for s in buf[1:])
            out.append('  <p><b>%s</b><br>%s</p>' % (inline(m.group(1)), inline(resto)))
        else:
            out.append('  <p>%s</p>' % inline(txt))
    buf = []
    while i < len(lines):
        ln = lines[i]
        if not ln.strip():
            parrafo(buf); buf = []; i += 1; continue
        if ln.startswith('# '):
            parrafo(buf); buf = []; i += 1; continue          # el h1 va en la plantilla
        if ln.startswith('## '):
            parrafo(buf); buf = []; out.append('\n  <h2>%s</h2>' % inline(ln[3:].strip())); i += 1; continue
        if ln.startswith('### '):
            parrafo(buf); buf = []; out.append('\n  <h3>%s</h3>' % inline(ln[4:].strip())); i += 1; continue
        if ln.strip() == '---':
            parrafo(buf); buf = []; i += 1; continue
        if ln.startswith('>'):
            parrafo(buf); buf = []; q = []
            while i < len(lines) and lines[i].startswith('>'):
                q.append(lines[i][1:].strip()); i += 1
            out.append('\n  <div class="callout">\n    %s\n  </div>' % inline(' '.join(q))); continue
        if ln.startswith('|'):
            parrafo(buf); buf = []; filas = []
            while i < len(lines) and lines[i].startswith('|'):
                filas.append(lines[i]); i += 1
            celdas = lambda r: [c.strip() for c in r.strip().strip('|').split('|')]
            cab = celdas(filas[0]); cuerpo = [celdas(r) for r in filas[2:]]
            t = ['  <table>', '    <tr>' + ''.join('<th>%s</th>' % inline(c) for c in cab) + '</tr>']
            for r in cuerpo:
                t.append('    <tr>' + ''.join(('<td><b>%s</b></td>' % inline(c)) if k == 0 and not c.startswith('**') else '<td>%s</td>' % inline(c) for k, c in enumerate(r)) + '</tr>')
            t.append('  </table>'); out.append('\n'.join(t)); continue
        m = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', ln)
        if m:
            parrafo(buf); buf = []; orden = m.group(2)[0].isdigit(); items = []
            while i < len(lines):
                mm = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', lines[i])
                if mm and mm.group(2)[0].isdigit() == orden:
                    items.append([mm.group(3)]); i += 1
                elif lines[i].strip() and lines[i].startswith((' ', '\t')) and items:
                    items[-1].append(lines[i].strip()); i += 1
                else:
                    break
            tag = 'ol' if orden else 'ul'
            out.append('  <%s>\n%s\n  </%s>' % (tag, '\n'.join('    <li>%s</li>' % inline(' '.join(x)) for x in items), tag)); continue
        buf.append(ln); i += 1
    parrafo(buf)
    return '\n'.join(out)

def main(repo, md_rel='docs/manual-usuario.md', html_rel='docs/manual-usuario.html', titulo='Manual de Usuario'):
    md = open(repo + '/' + md_rel, encoding='utf-8').read()
    plantilla = open(repo + '/docs/manual-usuario.html', encoding='utf-8').read()
    viejo = plantilla if html_rel == 'docs/manual-usuario.html' else open(repo + '/' + html_rel, encoding='utf-8').read() if __import__('os').path.exists(repo + '/' + html_rel) else plantilla
    viejo = re.sub(r'\\s*/\\* Ronda 4D \\*/.*?(?=</style>)', '', viejo, flags=re.S)
    viejo = viejo.replace('</style>', MANUAL_CSS + '</style>', 1)
    if html_rel != 'docs/manual-usuario.html' and viejo is plantilla:
        viejo = re.sub(r'<title>.*?</title>', '<title>%s — SistemaMP Centinela</title>' % html.escape(titulo, quote=False), viejo, count=1)
        viejo = re.sub(r'<h1>.*?</h1>', '<h1>%s</h1>' % html.escape(titulo, quote=False), viejo, count=1)
        # documentos largos con listas de funciones y tablas anchas: que nada empuje el ancho de la página en el celular
        viejo = viejo.replace('</style>', '  li,p,td,th{overflow-wrap:anywhere}\n  table{display:block;overflow-x:auto}\n</style>', 1)
    i = viejo.index('<h1>'); j = viejo.index('</h1>', i) + len('</h1>')
    cola = viejo[viejo.index('<footer>'):]
    cuerpo = convertir(md)
    # el último párrafo ("Para el detalle completo…") va como cuadro destacado, igual que antes
    cuerpo = re.sub(r'  <p>(Para el detalle completo.*?)</p>\s*$', r'\n  <div class="callout">\n    \1\n  </div>', cuerpo, flags=re.S)
    titulos = re.findall(r'<h([23])>(.*?)</h\\1>', cuerpo)
    indice = '<details class="doc-index" open><summary>Índice del manual</summary>' + ''.join('<a href="#doc-%s">%s</a>' % (n, t) for n, (_, t) in enumerate(titulos, 1)) + '</details>'
    cuerpo = re.sub(r'<h([23])>', lambda m: '<h%s id="doc-%s">' % (m.group(1), len(re.findall(r'<h[23]', cuerpo[:m.start()])) + 1), cuerpo)
    nuevo = viejo[:j] + '\n<div class="doc-layout">\n  ' + indice + '\n  <main class="doc-main">\n' + cuerpo + '\n  </main>\n</div>\n\n  <a class="back-top" href="#top">Volver arriba</a>\n\n  ' + cola
    nuevo = nuevo.replace('<div class="wrap">', '<div class="wrap" id="top">', 1)
    open(repo + '/' + html_rel, 'w', encoding='utf-8').write(nuevo)

if __name__ == '__main__':
    a = sys.argv[1:]
    main(a[0] if a else '.', *(a[1:4] if len(a) >= 4 else []))
