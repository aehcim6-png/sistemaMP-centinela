#!/usr/bin/env python3
"""Genera docs/manual-usuario.html a partir de docs/manual-usuario.md (misma plantilla visual que ya tiene el HTML).
Uso: python3 scripts/manual_md_a_html.py [carpeta_repo] [docs/otro.md docs/otro.html "Título"]
Con --decorar archivo.html… aplica solo el índice lateral/estilos a documentos de edición manual (idempotente).
Con los tres argumentos finales genera otro documento con la misma plantilla (por ejemplo el inventario de algoritmos).
Soporta lo que usa el manual: títulos, citas (cuadro destacado), tablas, listas con y sin número, párrafos, negrita, cursiva, código y enlaces [texto](https://…)."""
import html, re, sys

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


# ───────── Lectura cómoda de los manuales (índice lateral, tipografía, impresión) ─────────
# decorar() se aplica sobre cualquier documento de docs/ con la plantilla común (los generados desde .md y los de edición
# manual: manual-admin y arquitectura). Es idempotente: cada pieza va entre marcadores y se reemplaza, nunca se duplica.
# No toca el texto del documento: solo agrega ids a los títulos, el índice, estilos y un script corto para resaltar la sección activa.
DOC_CSS = """/* doc-lectura */
  html{scroll-behavior:smooth}
  body{padding:32px 20px 80px}
  .wrap{max-width:1120px}
  .doc-layout{display:grid;grid-template-columns:260px minmax(0,780px);gap:36px;align-items:start;margin-top:8px}
  .doc-main{min-width:0}
  .doc-layout>nav{position:sticky;top:16px;align-self:start;max-height:calc(100vh - 32px);overflow:auto;border-radius:8px}
  .doc-index{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 10px;font-size:13px}
  .doc-index summary{cursor:pointer;font-weight:700;color:var(--ink);padding:4px 6px;list-style:none}
  .doc-index summary::after{content:" ▾";color:var(--amber)}
  .doc-index a{display:block;color:var(--ink-dim);text-decoration:none;line-height:1.35;padding:5px 8px;border-radius:5px;overflow-wrap:anywhere}
  .doc-index a.h3{padding-left:20px;font-size:12px}
  .doc-index a:hover,.doc-index a:focus-visible{color:var(--amber);background:var(--panel2);outline:none}
  .doc-index a.activa{color:var(--amber);background:var(--panel2);font-weight:600}
  h2,h3{scroll-margin-top:20px;text-wrap:balance}
  p,ul,ol{font-size:15.5px;line-height:1.75;max-width:72ch}
  li{margin-bottom:5px}
  li,p,td,th{overflow-wrap:break-word}
  table{display:block;overflow-x:auto;max-width:100%}
  td:first-child,th:first-child{min-width:96px}
  pre{max-width:100%;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
  .back-top{position:fixed;right:16px;bottom:16px;background:var(--amber);color:var(--bg);border-radius:999px;padding:9px 14px;font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.3)}
  @media(max-width:860px){
    body{padding:20px 14px 72px}
    .doc-layout{display:block}
    .doc-layout>nav{position:static;max-height:60vh;margin:0 0 20px}
    .doc-index:not([open]) a{display:none}
    p,ul,ol{font-size:15px}
  }
  @media print{
    html{scroll-behavior:auto}
    :root{--bg:#fff;--panel:#fff;--panel2:#f4f4f4;--line:#bbb;--ink:#111;--ink-dim:#222;--amber:#7a4a00}
    body{background:#fff;color:#111;padding:0}
    .doc-index,.back-top{display:none}
    .doc-layout{display:block}
    .wrap{max-width:none}
    p,ul,ol{max-width:none;font-size:11pt}
    h2{break-after:avoid}h3{break-after:avoid}
    .callout,table,tr{break-inside:avoid}
    a{color:#111;text-decoration:none}
  }
/* /doc-lectura */"""

DOC_JS = """<script>/*doc-js*/
(function(){var L=[].slice.call(document.querySelectorAll('.doc-index a'));if(!L.length||!('IntersectionObserver' in window))return;
var m={};L.forEach(function(a){m[a.getAttribute('href').slice(1)]=a;});
var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){L.forEach(function(a){a.classList.remove('activa');});var a=m[e.target.id];if(a){a.classList.add('activa');if(a.scrollIntoView&&getComputedStyle(a.closest('.doc-index')).position==='sticky'){var c=a.closest('.doc-index');if(a.offsetTop<c.scrollTop||a.offsetTop>c.scrollTop+c.clientHeight-40)c.scrollTop=a.offsetTop-60;}}}});},{rootMargin:'0px 0px -75% 0px'});
Object.keys(m).forEach(function(id){var h=document.getElementById(id);if(h)o.observe(h);});})();
/*/doc-js*/</script>"""

def decorar(doc):
    # 1) quitar lo que se puso antes (idempotencia)
    doc = re.sub(r'\s*/\* doc-lectura \*/.*?/\* /doc-lectura \*/', '', doc, flags=re.S)
    doc = re.sub(r'<!--doc-ini-->.*?<!--/doc-ini-->', '', doc, flags=re.S)
    doc = re.sub(r'<!--doc-fin-->.*?<!--/doc-fin-->', '', doc, flags=re.S)
    doc = re.sub(r'\s*<a class="back-top"[^>]*>.*?</a>', '', doc, flags=re.S)
    doc = re.sub(r'\s*<script>/\*doc-js\*/.*?/\*/doc-js\*/</script>', '', doc, flags=re.S)
    doc = re.sub(r'<(h[23]) id="d-\d+">', r'<\1>', doc)
    doc = doc.replace('<div class="wrap" id="top">', '<div class="wrap">')
    # 2) ids en los títulos h2/h3 (en orden) y lista para el índice
    n = [0]; items = []
    def poner(m):
        n[0] += 1
        txt = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        items.append((m.group(1), n[0], txt))
        return '<%s id="d-%d">%s</%s>' % (m.group(1), n[0], m.group(2), m.group(1))
    i = doc.index('<h1>'); j = doc.index('</h1>', i) + len('</h1>')
    cola = doc.index('<footer>')
    cuerpo = re.sub(r'<(h[23])>(.*?)</\1>', poner, doc[j:cola], flags=re.S)
    links = ''.join('<a class="%s" href="#d-%d">%s</a>' % (t, k, html.escape(x, quote=False)) for t, k, x in items)
    ini = '<!--doc-ini--><div class="doc-layout"><nav aria-label="Índice del documento"><details class="doc-index" open><summary>Índice</summary>%s</details></nav><div class="doc-main"><!--/doc-ini-->' % links
    fin = '<!--doc-fin--></div></div><!--/doc-fin-->'
    head = doc[:j].replace('<div class="wrap">', '<div class="wrap" id="top">', 1)
    head = head.replace('</style>', '  ' + DOC_CSS + '\n</style>', 1)
    pie = doc[cola:].rstrip()
    # espacios fijos (no dependen de lo que hubiera antes): así correrlo dos veces da exactamente el mismo archivo
    return head.rstrip() + '\n\n' + ini + '\n' + cuerpo.strip() + '\n' + fin + '\n\n  <a class="back-top" href="#top">↑ Arriba</a>\n\n  ' + pie + '\n' + DOC_JS + '\n'

def main(repo, md_rel='docs/manual-usuario.md', html_rel='docs/manual-usuario.html', titulo='Manual de Usuario'):
    md = open(repo + '/' + md_rel, encoding='utf-8').read()
    plantilla = open(repo + '/docs/manual-usuario.html', encoding='utf-8').read()
    viejo = plantilla if html_rel == 'docs/manual-usuario.html' else open(repo + '/' + html_rel, encoding='utf-8').read() if __import__('os').path.exists(repo + '/' + html_rel) else plantilla
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
    nuevo = viejo[:j] + '\n' + cuerpo + '\n\n  ' + cola
    open(repo + '/' + html_rel, 'w', encoding='utf-8').write(decorar(nuevo))

if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--decorar':        # documentos de edición manual: python3 scripts/manual_md_a_html.py --decorar docs/arquitectura.html docs/manual-admin.html
        for f in a[1:]:
            d = open(f, encoding='utf-8').read()
            open(f, 'w', encoding='utf-8').write(decorar(d))
        sys.exit(0)
    main(a[0] if a else '.', *(a[1:4] if len(a) >= 4 else []))
