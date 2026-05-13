#!/usr/bin/env python3
"""
update_design.py
Apply high-end visual design system to all biogradix HTML files.
Run from the project root: python3 update_design.py
"""
import glob, re

# ── New floating-pill nav ─────────────────────────────────────────────────────
NEW_NAV = """\
<!-- NAV -->
<nav class="nav-outer">
  <div class="nav-pill">
    <a href="index.html" style="font-family:'Cormorant Display',serif;font-size:17px;font-weight:400;letter-spacing:.5px;color:var(--ink);text-decoration:none;flex-shrink:0;">bio<em style="font-style:italic;color:var(--forest);">gradix</em></a>
    <div class="nav-links-center">
      <a href="index.html#productos" class="nav-link" data-i18n="nav-productos">Productos</a>
      <a href="tecnologia.html" class="nav-link" data-i18n="nav-tecnologia">Tecnología</a>
      <a href="educacion.html" class="nav-link" data-i18n="nav-educacion">Educación</a>
      <a href="blog.html" class="nav-link" data-i18n="nav-blog">Blog</a>
      <a href="contacto.html" class="nav-link" data-i18n="nav-contacto">Contacto</a>
    </div>
    <div class="nav-actions">
      <button onclick="setLang('es')" class="lang-btn nav-lang-btn">ES</button>
      <span class="nav-lang-sep">/</span>
      <button onclick="setLang('en')" class="lang-btn nav-lang-btn">EN</button>
      <a href="quiz.html" class="nav-quiz-btn" data-i18n="nav-quiz">Quiz</a>
      <button id="hamburger" class="hamburger" aria-label="Menu">
        <span class="ham-line ham-top"></span>
        <span class="ham-line ham-mid"></span>
        <span class="ham-line ham-bot"></span>
      </button>
    </div>
  </div>
</nav>"""

# ── New full-screen glass mobile menu ─────────────────────────────────────────
NEW_MOBILE_MENU = """\
<!-- MOBILE MENU -->
<div id="mobileMenu">
  <div class="mobile-overlay-bg"></div>
  <div class="mobile-menu-content">
    <nav class="mobile-nav-items">
      <a href="index.html#productos" class="mobile-nav-item" style="--i:0" data-i18n="nav-productos">Productos</a>
      <a href="tecnologia.html" class="mobile-nav-item" style="--i:1" data-i18n="nav-tecnologia">Tecnología</a>
      <a href="educacion.html" class="mobile-nav-item" style="--i:2" data-i18n="nav-educacion">Educación</a>
      <a href="blog.html" class="mobile-nav-item" style="--i:3" data-i18n="nav-blog">Blog</a>
      <a href="contacto.html" class="mobile-nav-item" style="--i:4" data-i18n="nav-contacto">Contacto</a>
      <a href="quiz.html" class="mobile-nav-item" style="--i:5" data-i18n="nav-quiz">Quiz</a>
    </nav>
    <div class="mobile-menu-footer">
      <div class="mobile-lang-row">
        <button onclick="setLang('es')" class="lang-btn" style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;background:none;border:none;cursor:pointer;color:rgba(245,241,235,.5);">ES</button>
        <button onclick="setLang('en')" class="lang-btn" style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;background:none;border:none;cursor:pointer;color:rgba(245,241,235,.5);">EN</button>
      </div>
      <a href="https://wa.me/13467189350" class="mobile-wa-btn">WhatsApp</a>
    </div>
  </div>
</div>"""

# ── Updated hamburger JS ──────────────────────────────────────────────────────
OLD_HAMBURGER_JS = (
    "hamburger.addEventListener('click',()=>"
    "{const open=mobileMenu.classList.toggle('open');"
    "document.body.style.overflow=open?'hidden':'';});"
    "\n  mobileMenu.addEventListener('click',e=>"
    "{if(e.target===mobileMenu){mobileMenu.classList.remove('open');"
    "document.body.style.overflow='';}});"
)
# Fallback pattern (slightly different spacing in some files)
OLD_HAMBURGER_JS_ALT = (
    "hamburger.addEventListener('click',()=>{const open=mobileMenu.classList.toggle('open');"
    "document.body.style.overflow=open?'hidden':'';});\n"
    "  mobileMenu.addEventListener('click',e=>{if(e.target===mobileMenu){"
    "mobileMenu.classList.remove('open');document.body.style.overflow='';}});"
)
NEW_HAMBURGER_JS = (
    "hamburger.addEventListener('click',()=>{"
    "const open=mobileMenu.classList.toggle('open');"
    "hamburger.classList.toggle('open',open);"
    "document.body.style.overflow=open?'hidden':'';"
    "const bg=mobileMenu.querySelector('.mobile-overlay-bg');"
    "if(bg)bg.onclick=()=>{"
    "mobileMenu.classList.remove('open');"
    "hamburger.classList.remove('open');"
    "document.body.style.overflow='';};"
    "});"
)


def find_div_block_end(content, start_idx):
    """Return index just past the closing </div> of the div opening at start_idx."""
    depth = 0
    i = start_idx
    while i < len(content):
        if content[i:i+4] == '<div':
            depth += 1
            i += 4
        elif content[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                return i + 6
            i += 6
        else:
            i += 1
    return -1


def update_file(path):
    with open(path, encoding='utf-8') as f:
        orig = f.read()
    content = orig

    # 1. Inject shared.css link (after first </style>)
    if 'shared.css' not in content:
        content = content.replace('</style>', '</style>\n<link rel="stylesheet" href="shared.css"/>', 1)

    # 2. Inject Plus Jakarta Sans font link (before </head>)
    if 'Plus+Jakarta+Sans' not in content and '</head>' in content:
        font_link = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
                     '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
                     '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans'
                     ':ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap" rel="stylesheet"/>')
        content = content.replace('</head>', font_link + '\n</head>', 1)

    # 3. Replace nav block (from <!-- NAV --> up to <!-- MOBILE MENU -->)
    if '<!-- NAV -->' in content and 'class="nav-outer"' not in content:
        nav_start = content.find('<!-- NAV -->')
        menu_marker = content.find('<!-- MOBILE MENU -->', nav_start)
        if nav_start != -1 and menu_marker != -1:
            content = content[:nav_start] + NEW_NAV + '\n\n' + content[menu_marker:]

    # 4. Replace mobile menu block (from <!-- MOBILE MENU --> through </div> of #mobileMenu)
    if '<!-- MOBILE MENU -->' in content and 'class="mobile-overlay-bg"' not in content:
        menu_comment = content.find('<!-- MOBILE MENU -->')
        div_id_start = content.find('<div id="mobileMenu">', menu_comment)
        if menu_comment != -1 and div_id_start != -1:
            block_end = find_div_block_end(content, div_id_start)
            if block_end != -1:
                content = content[:menu_comment] + NEW_MOBILE_MENU + content[block_end:]

    # 5. Add grain overlay div right after <body>
    if 'grain-overlay' not in content:
        content = content.replace('<body>\n', '<body>\n<div class="grain-overlay"></div>\n', 1)
        if 'grain-overlay' not in content:  # fallback
            content = content.replace('<body>', '<body>\n<div class="grain-overlay"></div>', 1)

    # 6. Update hamburger + menu JS
    if OLD_HAMBURGER_JS in content:
        content = content.replace(OLD_HAMBURGER_JS, NEW_HAMBURGER_JS)
    elif OLD_HAMBURGER_JS_ALT in content:
        content = content.replace(OLD_HAMBURGER_JS_ALT, NEW_HAMBURGER_JS)
    else:
        # Regex fallback for minor whitespace variations
        pattern = (
            r"hamburger\.addEventListener\('click',\(\)=>\{const open=mobileMenu\.classList\.toggle\('open'\);"
            r"document\.body\.style\.overflow=open\?'hidden':'';}\);"
            r"\s*mobileMenu\.addEventListener\('click',e=>\{if\(e\.target===mobileMenu\)\{"
            r"mobileMenu\.classList\.remove\('open'\);document\.body\.style\.overflow='';}}\);"
        )
        content = re.sub(pattern, NEW_HAMBURGER_JS, content)

    # 7. Fix min-height:100vh → 100dvh (hero sections)
    content = content.replace('min-height:100vh', 'min-height:100dvh')
    content = content.replace('min-height: 100vh', 'min-height: 100dvh')

    # 8. Remove stale mobile CSS that targets old nav structure
    stale_rules = [
        "  nav>div:nth-child(2){display:none!important;}\n",
        "  nav{padding:0 20px!important;}\n",
        "  #hamburger{display:flex!important;}\n",
        "  .nav-quiz-btn{display:none!important;}\n",
    ]
    for rule in stale_rules:
        content = content.replace(rule, '')

    if content != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  ✓  {path}')
    else:
        print(f'  –  {path}  (no changes)')


print('Applying design system to all HTML files...\n')
files = sorted(glob.glob('*.html'))
for fp in files:
    update_file(fp)
print(f'\nDone — {len(files)} files processed.')
