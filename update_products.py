#!/usr/bin/env python3
"""
update_products.py
Apply Double-Bezel purity badge, pill CTAs, and tag pill upgrades
to all 7 product pages. Run from project root: python3 update_products.py
"""
import glob, re

PRODUCT_FILES = sorted(glob.glob('producto-*.html'))

# ── 1. Hero WhatsApp CTA → btn-pill ──────────────────────────────────────────
OLD_WA_CTA = (
    '<a href="https://wa.me/13467189350" '
    'style="font-size:11px;letter-spacing:2px;text-transform:uppercase;'
    'color:var(--bone);background:var(--ink);padding:14px 28px;'
    'border-radius:2px;text-decoration:none;" '
    'data-i18n="hero-wa">Consultar vía WhatsApp</a>'
)
NEW_WA_CTA = (
    '<a href="https://wa.me/13467189350" class="btn-pill" '
    'style="font-size:11px;letter-spacing:2px;text-transform:uppercase;'
    'color:var(--bone);background:var(--ink);padding:14px 32px 14px 32px;'
    'text-decoration:none;display:inline-flex;align-items:center;gap:10px;" '
    'data-i18n="hero-wa">Consultar vía WhatsApp<span class="btn-icon">→</span></a>'
)

# ── 2. Purity badge → Double-Bezel ───────────────────────────────────────────
# The old badge is a flat div with position:absolute and border-radius:2px.
# Use regex to capture it and replace with nested .purity-badge structure.
# Pattern matches the entire old badge div block.
PURITY_BADGE_PATTERN = re.compile(
    r'<div style="position:absolute;top:24px;right:-20px;background:var\(--bone\);'
    r'border:1px solid var\(--rule\);padding:12px 18px;border-radius:2px;z-index:2;">'
    r'(.*?)'
    r'</div>\s*</div>',   # closes inner + outer
    re.DOTALL
)

def purity_badge_replacer(m):
    inner_content = m.group(1)
    return (
        '<div class="purity-badge">\n'
        '        <div class="purity-badge-inner">'
        + inner_content +
        '</div>\n'
        '      </div>'
    )

# ── 3. Small tag pills (duration / audience) → border-radius:9999px ──────────
# Targets <span> labels in the hero with border-radius:2px
OLD_TAG_STYLE = 'border:1px solid var(--rule);padding:8px 16px;border-radius:2px;'
NEW_TAG_STYLE = 'border:1px solid var(--rule);padding:8px 16px;border-radius:9999px;'

# ── 4. 100vh inside calc() → 100dvh ──────────────────────────────────────────
OLD_CALC_VH = 'min-height:calc(100vh - 64px)'
NEW_CALC_VH = 'min-height:calc(100dvh - 64px)'

# ── 5. Quiz section CTA → btn-pill ───────────────────────────────────────────
OLD_QUIZ_CTA = (
    'style="font-size:11px;letter-spacing:2px;text-transform:uppercase;'
    'color:var(--bone);background:var(--ink);padding:16px 36px;'
    'border-radius:2px;text-decoration:none;" data-i18n="quiz-cta">'
    'Encontrar mi protocolo →</a>'
)
NEW_QUIZ_CTA = (
    'class="btn-pill" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;'
    'color:var(--bone);background:var(--ink);padding:16px 40px 16px 40px;'
    'text-decoration:none;display:inline-flex;align-items:center;gap:10px;" '
    'data-i18n="quiz-cta">Encontrar mi protocolo<span class="btn-icon">→</span></a>'
)

# ── 6. Footer WhatsApp CTA → btn-pill ────────────────────────────────────────
OLD_FOOT_WA = (
    'style="font-size:11px;letter-spacing:2px;text-transform:uppercase;'
    'color:var(--bone);background:var(--forest);padding:12px 24px;'
    'border-radius:2px;text-decoration:none;" data-i18n="foot-wa">WhatsApp</a>'
)
NEW_FOOT_WA = (
    'class="btn-pill" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;'
    'color:var(--bone);background:var(--forest);padding:11px 24px;'
    'text-decoration:none;display:inline-flex;align-items:center;gap:8px;" '
    'data-i18n="foot-wa">WhatsApp<span class="btn-icon" style="background:rgba(245,241,235,0.2);">→</span></a>'
)


def update_file(path):
    with open(path, encoding='utf-8') as f:
        orig = f.read()
    content = orig

    # WhatsApp CTA → btn-pill
    content = content.replace(OLD_WA_CTA, NEW_WA_CTA)

    # Purity badge → Double-Bezel
    content = PURITY_BADGE_PATTERN.sub(purity_badge_replacer, content)

    # Tag pills
    content = content.replace(OLD_TAG_STYLE, NEW_TAG_STYLE)

    # calc(100vh) → 100dvh
    content = content.replace(OLD_CALC_VH, NEW_CALC_VH)

    # Quiz CTA → btn-pill
    content = content.replace(OLD_QUIZ_CTA, NEW_QUIZ_CTA)

    # Footer WA → btn-pill
    content = content.replace(OLD_FOOT_WA, NEW_FOOT_WA)

    if content != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  ✓  {path}')
    else:
        print(f'  –  {path}  (no changes)')


print('Upgrading product pages...\n')
for fp in PRODUCT_FILES:
    update_file(fp)
print(f'\nDone — {len(PRODUCT_FILES)} files processed.')
