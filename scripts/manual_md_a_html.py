#!/usr/bin/env python3
"""Genera docs/manual-usuario.html a partir de docs/manual-usuario.md (misma plantilla visual que ya tiene el HTML).
Uso: python3 scripts/manual_md_a_html.py [carpeta_repo]
Soporta lo que usa el manual: títulos, citas (cuadro destacado), tablas, listas con y sin número, párrafos, negrita, cursiva y código."""
import html, re, sys

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
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

def main(repo):
    md = open(repo + '/docs/manual-usuario.md', encoding='utf-8').read()
    viejo = open(repo + '/docs/manual-usuario.html', encoding='utf-8').read()
    i = viejo.index('<h1>'); j = viejo.index('</h1>', i) + len('</h1>')
    cola = viejo[viejo.index('<footer>'):]
    cuerpo = convertir(md)
    # el último párrafo ("Para el detalle completo…") va como cuadro destacado, igual que antes
    cuerpo = re.sub(r'  <p>(Para el detalle completo.*?)</p>\s*$', r'\n  <div class="callout">\n    \1\n  </div>', cuerpo, flags=re.S)
    nuevo = viejo[:j] + '\n' + cuerpo + '\n\n  ' + cola
    open(repo + '/docs/manual-usuario.html', 'w', encoding='utf-8').write(nuevo)

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
