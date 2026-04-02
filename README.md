# Biogradix — Pharmaceutical-Grade Bioactives

**Donde la ciencia encuentra su potencial**  
*Where science meets potential*

---

## Brand Identity

### Positioning
Biogradix is a research-focused platform providing **pharmaceutical-grade bioactives and peptides** to the Mexican and Latin American market. Our competitive moat is **trust and traceability** — in a market where buyers cannot verify product origin, we provide transparent U.S. sourcing, third-party testing, and expert guidance.

### Target Audience (Three Segments)
1. **GLP-1 Weight Loss Users** (skewing female, 35–60)
2. **Recovery/Performance Biohackers** (skewing male, 30–55)
3. **Anti-Aging/Longevity Seekers** (women 40+) — fastest-growing segment

### Core Values
- **Clinical Confidence**: Reference COAs, purity data, and manufacturing standards. No hype.
- **Accessible Expertise**: Complex science in clear language for all experience levels.
- **Warm, Not Sterile**: Conversational Spanish on WhatsApp. Be the knowledgeable friend.
- **Gender-Neutral**: Speak equally to biohackers and women seeking anti-aging support.

---

## Visual Identity

### Logo & Wordmark
- **Primary**: `biogradix` (always lowercase)
- **Monogram**: `bx` (favicons, WhatsApp profile, vial labels)
- **Tagline**: *"Donde la ciencia encuentra su potencial"* (Spanish-primary)

### Color System
| Color | Hex | Usage |
|-------|-----|-------|
| Navy | `#0B1A2B` | Primary text, backgrounds, headers |
| Teal | `#0F6E56` | CTAs, category labels, accents |
| Mint | `#E1F5EE` | Light backgrounds, education cards |
| Cloud | `#FAFBFC` | Primary background |
| Silver | `#E8EAED` | Borders, secondary backgrounds |
| Deep Teal | `#085041` | Hover states, dark accents |
| Active Teal | `#1D9E75` | Active buttons, engagement |
| Gold | `#C9A84C` | Premium badges, featured CTAs only |
| Alert | `#D4534E` | Warnings, out-of-stock, disclaimers |

### Typography
- **Display**: Instrument Serif (italic for taglines, headers)
- **Headings**: DM Sans Medium (18px+)
- **Body**: DM Sans Regular (14px, for descriptions and long-form)
- **Technical**: DM Mono (specs, COA data, dosing protocols)
- **Labels**: DM Mono uppercase, 10px, 3px letter-spacing (categories, status, tags)

### Trust Bar
Visible below navigation on all pages:  
*U.S. Manufactured · Third-party Tested · ≥99% Purity*

---

## Website Structure

### Pages & Sections

#### 1. **Navigation**
- Biogradix logo (left)
- Language toggle (EN / ES)
- WhatsApp CTA button (right)

#### 2. **Trust Bar**
- Below navigation
- U.S. manufacturing, third-party testing, purity claims

#### 3. **Hero Section**
- Large wordmark `biogradix`
- Bilingual tagline
- Pharmaceutical-grade descriptor
- CTA: "Explore Products"

#### 4. **Research Use Disclaimer**
- Alert-colored box
- Full disclosure of research-only purpose
- Not for human consumption

#### 5. **Products Section**
- Filter buttons: All, Peptides, Compounds, Blends
- Product grid (responsive, 3-column on desktop)
- Each card includes:
  - Category label (uppercase)
  - Product name
  - Description (bilingual)
  - Spec block (monospace, gray background)
  - "Request Info" button → WhatsApp contact
- Products featured:
  - BPC-157
  - TB-500
  - GHK-Cu
  - NAD+
  - GLOW Blend (BPC-157 + TB-500 + GHK-Cu)
  - Selank

#### 6. **Education & Research Section**
- Three cards:
  - COA Documents
  - Research Library
  - Expert Support (WhatsApp)

#### 7. **Contact Section**
- Large WhatsApp CTA
- Bilingual messaging

#### 8. **Footer**
- Links: Terms, Privacy, Contact (bilingual)
- Copyright & research-only disclaimer

---

## Bilingual Implementation

All user-facing text uses `data-lang` attributes:
```html
<span data-lang="en">English text</span>
<span data-lang="es">Spanish text</span>
```

JavaScript toggles language via `setLanguage(lang)` function. Language preference is saved in `localStorage`.

---

## WhatsApp Integration

- **WhatsApp Business Number**: `+52 55 1234 5678` (placeholder — update with real number)
- All CTAs open WhatsApp with pre-filled product inquiry messages
- Conversational, Spanish-primary support

---

## go-to-Market Strategy

1. **Zero Inventory Launch**: Validate demand via WhatsApp before building infrastructure
2. **Trust-First Positioning**: Lead with U.S. sourcing, COAs, and expert guidance
3. **Bilingual Strength**: Spanish-primary, but accessible to English-speaking researchers
4. **Community Building**: Educational content on Instagram, WhatsApp support
5. **Future Product Roadmap**: Transdermal patches, supplement blends (same brand system)

---

## Technical Notes

- Single-page HTML file for simplicity and GitHub Pages compatibility
- Fully responsive (mobile-first design)
- No external dependencies beyond Google Fonts
- Product data stored in JavaScript arrays (easy to update)
- Language toggle persists across sessions via localStorage

---

## Next Steps

1. **Update WhatsApp Number**: Replace `525512345678` with real business number
2. **Add COA Documents**: Create PDF templates linked from education section
3. **Expand Research Library**: Partner articles, peer-reviewed studies
4. **Instagram Integration**: Educational carousel templates
5. **Domain Setup**: Connect `biogradix.com` to GitHub Pages
6. **Email Contact Form**: Optional backend integration

---

## Brand Files

- **Brand Guidelines**: See `biogradix_final_brand_identity.html` for full visual identity documentation
- **Color Palette**: All colors defined in CSS variables at root level
- **Fonts**: Imported from Google Fonts (DM Sans, DM Mono, Instrument Serif)

---

**Last Updated**: April 2, 2026  
**Owner**: Alejandro  
**Status**: Live on GitHub Pages
