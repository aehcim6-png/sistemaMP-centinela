#!/usr/bin/env python3
"""Genera docs/plano-fallas.html y docs/plano-fallas.md a partir de docs/plano-fallas.json (la ÚNICA fuente: se edita el JSON, nunca los generados).
Uso: python3 scripts/generar_plano_fallas.py [carpeta_repo]     escribe los dos archivos
     python3 scripts/generar_plano_fallas.py --check [carpeta]  sale con error si los archivos generados no coinciden con el JSON (lo usa una prueba)
El plano cubre los dos proyectos (centinela y mp2): las direcciones llevan marcas {sb}, {url}, {vercel}, {repo}, {ref} que la página reemplaza al elegir el proyecto."""
import html, json, os, re, sys

def cargar(raiz):
    with open(os.path.join(raiz, 'docs', 'plano-fallas.json'), encoding='utf-8') as f:
        return json.load(f)

def valores(p):
    return {'sb': 'https://supabase.com/dashboard/project/' + p['ref'], 'url': p['url'], 'vercel': p['vercel'], 'repo': p['repo'], 'ref': p['ref']}

def sustituir(t, v):
    return re.sub(r'\{(sb|url|vercel|repo|ref)\}', lambda m: v[m.group(1)], t)

def inline(t, v0):
    """Texto con `código` y marcas {x}: las marcas quedan en un span que el script de la página reemplaza al elegir proyecto."""
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return re.sub(r'\{(sb|url|vercel|repo|ref)\}', lambda m: '<span class="pv" data-k="%s">%s</span>' % (m.group(1), v0[m.group(1)]), t)

def enlace(t, v0):
    """Valor de «Dónde está»: si es una dirección (o empieza con una marca de dirección) se vuelve enlace."""
    solo = t.strip()
    m = re.match(r'^((?:\{(?:sb|url)\}|https://)\S*)$', solo)
    if m:
        return '<a class="pl" data-tpl="%s" href="%s" target="_blank" rel="noopener noreferrer">%s</a>' % (html.escape(solo, quote=True), html.escape(sustituir(solo, v0), quote=True), html.escape(sustituir(solo, v0), quote=False))
    # «`repo` → https://github.com/{repo}» y similares: dirección al final
    m = re.match(r'^(.*?)(https://github\.com/\{repo\})$', solo)
    if m:
        return inline(m.group(1), v0) + '<a class="pl" data-tpl="https://github.com/{repo}" href="https://github.com/%s" target="_blank" rel="noopener noreferrer">https://github.com/<span class="pv" data-k="repo">%s</span></a>' % (v0['repo'], v0['repo'])
    # texto con una dirección dentro («{sb}/functions/x (Logs…)»)
    m = re.match(r'^(\{sb\}\S*|https://\S+)(.*)$', solo)
    if m:
        return enlace(m.group(1), v0) + inline(m.group(2), v0)
    return inline(solo, v0)

def corto(n):
    for pre in ('Función: ', 'Tarea programada: '):
        if n.startswith(pre): return n[len(pre):]
    return n

def alimenta(piezas):
    inv = {p['id']: [] for p in piezas}
    for p in piezas:
        for d in p['depende_de']:
            inv.setdefault(d, []).append(p['id'])
    return inv

COLOR = {'equipo': 'var(--ink-dim)', 'publicacion': 'var(--amber)', 'supabase': 'var(--green)', 'externo': 'var(--blue)', 'vigilancia': 'var(--violet)'}

def svg(reg):
    piezas = reg['piezas']; W = 1000; xs = 150; bw = 112; bh = 44; gap = 8; y = 14
    out = []
    def caja(p, x, yy, w=bw):
        col = COLOR[p['capa']]
        inactivo = p.get('estado')
        t = html.escape(corto(p['nombre']), quote=False)
        t = t if len(t) <= 19 else t[:18] + '…'
        return ('<a href="#ficha-%s"><g class="caja%s"><rect x="%d" y="%d" width="%d" height="%d" rx="6" style="stroke:%s"%s/>'
                '<text x="%d" y="%d" class="cod" style="fill:%s">%s</text><text x="%d" y="%d" class="nom">%s</text></g></a>') % (
            p['id'], ' inactiva' if inactivo else '', x, yy, w, bh, col, ' stroke-dasharray="4 3"' if inactivo else '', x + 8, yy + 17, col, p['id'], x + 8, yy + 34, t)
    def fila(ids, y0, por_fila=7):
        ps = [next(p for p in piezas if p['id'] == i) for i in ids]
        for n, p in enumerate(ps):
            out.append(caja(p, xs + (n % por_fila) * (bw + gap), y0 + (n // por_fila) * (bh + gap)))
        return y0 + ((len(ps) - 1) // por_fila + 1) * (bh + gap)
    def banda(titulo, y0, y1, col):
        out.append('<rect x="8" y="%d" width="%d" height="%d" rx="8" class="banda"/>' % (y0, W - 16, y1 - y0))
        out.append('<text x="20" y="%d" class="tit" style="fill:%s">%s</text>' % (y0 + 20, col, html.escape(titulo, quote=False)))
    def flecha(y0, txt):
        out.append('<line x1="75" y1="%d" x2="75" y2="%d" class="flecha"/><polygon points="70,%d 80,%d 75,%d" class="punta"/><text x="86" y="%d" class="rel">%s</text>' % (y0, y0 + 20, y0 + 16, y0 + 16, y0 + 24, y0 + 15, html.escape(txt, quote=False)))
    por = {}
    for p in piezas: por.setdefault(p['capa'], []).append(p['id'])
    def banda_con(capa, titulo, bloques):
        nonlocal y
        y0 = y; yy = y + 30   # deja una línea arriba para el título de la banda
        for sub, ids, nf in bloques:
            if sub:
                out.append('<text x="%d" y="%d" class="sub">%s</text>' % (xs, yy + 8, html.escape(sub, quote=False))); yy += 14
            yy = fila(ids, yy, nf)
        banda(titulo, y0, yy + 4, COLOR[capa]); y = yy + 4
    cap = dict(reg['capas'])
    banda_con('equipo', cap['equipo'], [(None, por['equipo'], 7)]); flecha(y + 2, 'descarga el sitio'); y += 28
    banda_con('publicacion', cap['publicacion'], [(None, por['publicacion'], 7)]); flecha(y + 2, 'se conecta a los datos'); y += 28
    sup = por['supabase']
    base = [i for i in sup if i.startswith(('AUT', 'DB'))]; crn = [i for i in sup if i.startswith('CRN')]; efs = [i for i in sup if i.startswith('EF')]
    banda_con('supabase', cap['supabase'], [('Base y acceso', base, 7), ('Tareas programadas (reloj)', crn, 7), ('Funciones', efs, 7)]); flecha(y + 2, 'usa servicios de afuera'); y += 28
    banda_con('externo', cap['externo'], [(None, por['externo'], 7)]); flecha(y + 2, 'vigila a todos'); y += 28
    banda_con('vigilancia', cap['vigilancia'], [(None, por['vigilancia'], 7)])
    # los códigos que viven en otra capa visual (EXT-04 está en «externo»; AUT-01 lo usa): ya están en su banda
    return '<svg viewBox="0 0 %d %d" role="img" aria-label="Esquema de piezas del sistema con su código">%s</svg>' % (W, y + 10, ''.join(out))

CSS = """
  :root{--bg:#0a0c10;--panel:#12151c;--panel2:#171b24;--line:#232838;--ink:#e7e9ee;--ink-dim:#8992a3;--amber:#f2a93b;--green:#3ecf8e;--blue:#6aa9ff;--violet:#c792ea;--red:#ef6b6b;
    --mono:ui-monospace,"SF Mono","Cascadia Code","JetBrains Mono",Menlo,Consolas,monospace;--sans:"IBM Plex Sans",ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  :root[data-theme="light"]{--bg:#f3f1ea;--panel:#fff;--panel2:#faf8f2;--line:#ddd6c4;--ink:#1f2430;--ink-dim:#666f80;--amber:#b5710f;--green:#0e8a5c;--blue:#1f5fbf;--violet:#7b3fb0;--red:#c23b3b}
  @media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#f3f1ea;--panel:#fff;--panel2:#faf8f2;--line:#ddd6c4;--ink:#1f2430;--ink-dim:#666f80;--amber:#b5710f;--green:#0e8a5c;--blue:#1f5fbf;--violet:#7b3fb0;--red:#c23b3b}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);padding:32px 18px 64px}.wrap{max-width:1040px;margin:0 auto}
  .eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin:0 0 10px}
  h1{font-size:clamp(26px,4vw,36px);line-height:1.15;margin:0 0 12px;font-weight:700}h2{font-size:21px;margin:44px 0 6px}h3{margin:0}
  .lede{color:var(--ink-dim);font-size:15.5px;line-height:1.6;max-width:68ch;margin:0 0 22px}.lede b{color:var(--ink)}
  code{font-family:var(--mono);font-size:.9em;background:var(--panel2);border:1px solid var(--line);border-radius:4px;padding:0 4px}
  a{color:var(--blue)}.proy{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px;align-items:center;font-size:13px;color:var(--ink-dim)}
  .proy button{font:inherit;padding:7px 14px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer}
  .proy button[aria-pressed=true]{border-color:var(--amber);color:var(--amber);font-weight:600}
  .diagram{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:8px}svg{display:block;width:100%;height:auto;min-width:760px}
  .banda{fill:none;stroke:var(--line)}.tit{font:700 12px var(--mono);letter-spacing:.05em}.sub{font:600 10px var(--mono);fill:var(--ink-dim)}
  .caja rect{fill:var(--panel2);stroke-width:1.4}.caja:hover rect{fill:var(--line)}.caja.inactiva{opacity:.55}.cod{font:700 11px var(--mono)}.nom{font:9.5px var(--sans);fill:var(--ink-dim)}
  .flecha{stroke:var(--ink-dim);stroke-width:1.4}.punta{fill:var(--ink-dim)}.rel{font:10px var(--mono);fill:var(--ink-dim)}svg a{text-decoration:none;cursor:pointer}
  .cap{font-size:13px;color:var(--ink-dim);margin:10px 0 0;max-width:80ch;line-height:1.55}
  table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:14px}
  th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}th{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--amber);background:var(--panel2)}
  .chip{display:inline-block;font:700 11.5px var(--mono);padding:2px 7px;border-radius:5px;border:1px solid var(--line);margin:0 4px 4px 0;text-decoration:none;color:var(--ink)}.chip:hover{border-color:var(--amber)}
  details.f{background:var(--panel);border:1px solid var(--line);border-radius:10px;margin:0 0 10px}details.f>summary{cursor:pointer;padding:12px 16px;list-style:none;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
  details.f>summary::-webkit-details-marker{display:none}.id{font:700 13px var(--mono)}.nm{font-weight:600}.est{font:11px var(--mono);color:var(--red);border:1px solid var(--red);border-radius:5px;padding:1px 6px}
  .cuerpo{padding:2px 18px 16px;border-top:1px solid var(--line);font-size:14px;line-height:1.55}.cuerpo h4{margin:14px 0 4px;font:700 11px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--amber)}
  .cuerpo ul,.cuerpo ol{margin:4px 0 0;padding-left:20px}.cuerpo li{margin:2px 0}.dim{color:var(--ink-dim)}.tec{margin-top:12px;border-top:1px dashed var(--line);padding-top:8px}.tec summary{cursor:pointer;font:600 12px var(--mono);color:var(--ink-dim)}
  .aviso{background:var(--panel);border-left:3px solid var(--amber);padding:10px 14px;border-radius:6px;font-size:14px;color:var(--ink-dim);margin:12px 0}.aviso b{color:var(--ink)}
  footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font:11.5px var(--mono);color:var(--ink-dim)}
"""

JS = """
(function(){
  var P=%s,cur=null;
  function vals(k){var p=P[k];return {sb:'https://supabase.com/dashboard/project/'+p.ref,url:p.url,vercel:p.vercel,repo:p.repo,ref:p.ref};}
  function sub(t,v){return t.replace(/\\{(sb|url|vercel|repo|ref)\\}/g,function(m,k){return v[k];});}
  function set(k){cur=k;var v=vals(k);
    document.querySelectorAll('.pv').forEach(function(e){e.textContent=v[e.dataset.k];});
    document.querySelectorAll('.pl').forEach(function(e){var u=sub(e.dataset.tpl,v);e.href=u;e.textContent=u;});
    document.querySelectorAll('.proy button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.p===k?'true':'false');});
    try{localStorage.setItem('planoFallasProyecto',k);}catch(e){}}
  document.querySelectorAll('.proy button').forEach(function(b){b.addEventListener('click',function(){set(b.dataset.p);});});
  var ini='%s';try{var g=localStorage.getItem('planoFallasProyecto');if(g&&P[g])ini=g;}catch(e){}
  set(ini);
  function abrir(){var h=location.hash;if(h.indexOf('#ficha-')===0){var d=document.getElementById(h.slice(1));if(d&&d.tagName==='DETAILS')d.open=true;}}
  window.addEventListener('hashchange',abrir);abrir();
})();
"""

def lista(items, v0, ordenada=False):
    tag = 'ol' if ordenada else 'ul'
    return '<%s>%s</%s>' % (tag, ''.join('<li>%s</li>' % inline(x, v0) for x in items), tag)

def chips(ids):
    return ''.join('<a class="chip" href="#ficha-%s">%s</a>' % (i, i) for i in ids)

def generar_html(reg):
    ps = reg['piezas']; v0 = valores(reg['proyectos']['centinela']); inv = alimenta(ps)
    pj = {k: {'ref': p['ref'], 'url': p['url'], 'vercel': p['vercel'], 'repo': p['repo']} for k, p in reg['proyectos'].items()}
    botones = ''.join('<button type="button" data-p="%s" aria-pressed="false">%s</button>' % (k, html.escape(p['nombre'])) for k, p in reg['proyectos'].items())
    filas = ''.join('<tr><td>%s</td><td>%s</td></tr>' % (html.escape(s['texto'], quote=False), chips(s['codigos'])) for s in reg['sintomas'])
    filas += ''.join('<tr><td>%s</td><td class="dim">%s</td></tr>' % (html.escape(n['texto'], quote=False), html.escape(n['explicacion'], quote=False)) for n in reg.get('no_son_fallas', []))
    fichas = []
    for cid, ctit in reg['capas']:
        fichas.append('<h2>%s</h2>' % html.escape(ctit, quote=False))
        for p in [x for x in ps if x['capa'] == cid]:
            donde = ''.join('<li><b>%s:</b> %s</li>' % (html.escape(k, quote=False), enlace(t, v0)) for k, t in p['donde'])
            tec = ('<details class="tec"><summary>Para soporte técnico (Claude)</summary>%s</details>' % lista(p['claude'], v0)) if p['claude'] else ''
            dep = ('<h4>Depende de</h4><p>%s</p>' % chips(p['depende_de'])) if p['depende_de'] else ''
            ali = ('<h4>Si falla, afecta a</h4><p>%s</p>' % chips(sorted(inv.get(p['id'], [])))) if inv.get(p['id']) else ''
            esc = ('<h4>Cuándo avisar</h4><p>%s</p>' % inline(p['escalar'], v0)) if p['escalar'] else ''
            est = '<span class="est">%s</span>' % html.escape(p['estado'], quote=False) if p.get('estado') else ''
            fichas.append('<details class="f" id="ficha-%s"><summary><span class="id" style="color:%s">%s</span><span class="nm">%s</span>%s</summary><div class="cuerpo"><p>%s</p><h4>Dónde está</h4><ul>%s</ul><h4>Cómo se ve cuando falla</h4>%s<h4>Cómo confirmarlo (en este orden)</h4>%s<h4>Qué hacer</h4>%s%s%s%s%s</div></details>' % (
                p['id'], COLOR[p['capa']], p['id'], html.escape(p['nombre'], quote=False), est, inline(p['que_es'], v0), donde, lista(p['sintomas'], v0), lista(p['revisar'], v0, True), lista(p['accion'], v0), esc, dep, ali, tec))
    cuerpo = ('<div class="wrap"><p class="eyebrow">SistemaMP · plano de fallas</p><h1>Si algo falla, dónde buscar</h1>'
      '<p class="lede">Cada pieza del sistema tiene un <b>código</b> (como el rotulado de un tablero eléctrico), una <b>ubicación</b> (el panel donde se ve) y una ficha con <b>cómo se ve cuando falla</b>, <b>cómo confirmarlo</b> y <b>qué hacer</b>. Parte por la tabla «Si ves esto…»: te lleva al código; el código te lleva a la ficha.</p>'
      '<div class="proy"><span>Proyecto:</span>' + botones + '</div>'
      '<h2 style="margin-top:8px">Esquema de piezas</h2><div class="diagram">' + svg(reg) + '</div>'
      '<p class="cap">Cada caja es una pieza; toca una para ir a su ficha. Las flechas muestran de qué capa depende la siguiente: si una capa de arriba falla, todo lo de abajo que depende de ella también se ve afectado. Las cajas punteadas están sin uso hoy.</p>'
      '<h2>Si ves esto, mira primero…</h2><div class="aviso"><b>Regla de oro:</b> si se trata de una tarea programada (respaldo, alertas, resumen), lo primero es la tabla <code>salud_crons</code> (MON-01): dice cuál corrió, cuándo y si salió bien.</div>'
      '<table><tr><th>Lo que ves</th><th>Códigos, en orden de probabilidad</th></tr>' + filas + '</table>'
      + ''.join(fichas) +
      '<footer>Versión %s · generado desde <code>docs/plano-fallas.json</code> (no se edita a mano) con <code>scripts/generar_plano_fallas.py</code> · una prueba automática revisa que toda función, tarea programada y servicio del repositorio tenga su código aquí.</footer></div>' % reg['version'])
    return ('<!DOCTYPE html>\n<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plano de fallas — SistemaMP</title><style>%s</style></head><body>%s<script>%s</script></body></html>\n'
            % (CSS, cuerpo, JS % (json.dumps(pj, ensure_ascii=False), 'centinela')))

def generar_md(reg):
    ps = reg['piezas']; inv = alimenta(ps); L = []
    L.append('# Plano de fallas — dónde buscar cuando algo falla\n')
    L.append('> Archivo generado desde `docs/plano-fallas.json` con `scripts/generar_plano_fallas.py`. **No se edita a mano.** Es el mapa que se lee primero ante cualquier falla (también está en `docs/plano-fallas.html` con esquema visual).\n')
    L.append('## Proyectos\n')
    L.append('| Proyecto | Supabase (ref) | Vercel | Sitio | Repositorio |\n|---|---|---|---|---|')
    for k, p in reg['proyectos'].items():
        L.append('| %s | `%s` | `%s` | %s | `%s` |' % (p['nombre'], p['ref'], p['vercel'], p['url'], p['repo']))
    L.append('\nLas marcas `{sb}`, `{url}`, `{vercel}`, `{repo}`, `{ref}` de las fichas se reemplazan con los valores del proyecto en cuestión (`{sb}` = `https://supabase.com/dashboard/project/<ref>`).\n')
    L.append('## Si ves esto, mira primero…\n')
    L.append('| Lo que se ve | Códigos (orden de probabilidad) |\n|---|---|')
    for s in reg['sintomas']: L.append('| %s | %s |' % (s['texto'], ', '.join(s['codigos'])))
    for n in reg.get('no_son_fallas', []): L.append('| %s | _%s_ |' % (n['texto'], n['explicacion']))
    L.append('\n**Regla de oro:** ante una tarea programada (respaldo, alertas, resumen) lo primero es `select nombre, "ultimaEjecucion", exito, detalle from public.salud_crons;` (MON-01).\n')
    for cid, ctit in reg['capas']:
        L.append('## %s\n' % ctit)
        for p in [x for x in ps if x['capa'] == cid]:
            L.append('### %s — %s%s\n' % (p['id'], p['nombre'], ' _(%s)_' % p['estado'] if p.get('estado') else ''))
            L.append(p['que_es'] + '\n')
            for k, t in p['donde']: L.append('- **%s:** %s' % (k, t))
            L.append('\n**Cómo se ve:** ' + '; '.join(p['sintomas']) + '\n')
            L.append('**Confirmar:**\n' + '\n'.join('%d. %s' % (i + 1, x) for i, x in enumerate(p['revisar'])) + '\n')
            L.append('**Qué hacer:** ' + ' '.join(p['accion']) + '\n')
            if p['escalar']: L.append('**Cuándo avisar:** ' + p['escalar'] + '\n')
            if p['depende_de']: L.append('**Depende de:** ' + ', '.join(p['depende_de']))
            if inv.get(p['id']): L.append('**Si falla, afecta a:** ' + ', '.join(sorted(inv[p['id']])))
            if p['claude']: L.append('\n**Soporte técnico (Claude):**\n' + '\n'.join('- ' + x for x in p['claude']))
            L.append('')
    return '\n'.join(L) + '\n'

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    raiz = args[0] if args else '.'
    reg = cargar(raiz)
    salidas = {'docs/plano-fallas.html': generar_html(reg), 'docs/plano-fallas.md': generar_md(reg)}
    if '--check' in sys.argv:
        malos = [n for n, c in salidas.items() if not os.path.exists(os.path.join(raiz, n)) or open(os.path.join(raiz, n), encoding='utf-8').read() != c]
        if malos:
            print('Desactualizados (corre python3 scripts/generar_plano_fallas.py): ' + ', '.join(malos)); sys.exit(1)
        print('ok'); return
    for n, c in salidas.items():
        with open(os.path.join(raiz, n), 'w', encoding='utf-8') as f: f.write(c)
    print('generados: ' + ', '.join(salidas))

if __name__ == '__main__':
    main()
