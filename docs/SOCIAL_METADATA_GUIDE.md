# biogradix Social Media Metadata Guide

## ✅ What Was Implemented

All pages now include comprehensive Open Graph and Twitter Card metadata for rich link previews when shared on social media platforms.

### **Metadata Added:**

#### 1. **Open Graph Meta Tags**
These tags control how links appear when shared on Facebook, LinkedIn, WhatsApp, and other platforms.

```html
<meta property="og:type" content="website">
<meta property="og:url" content="https://biogradix.com/">
<meta property="og:title" content="biogradix — Donde la ciencia encuentra su potencial">
<meta property="og:description" content="Bioactivos de grado farmacéutico...">
<meta property="og:image" content="https://biogradix.com/og-image.png">
<meta property="og:site_name" content="biogradix">
<meta property="og:locale" content="es_MX">
<meta property="og:locale:alternate" content="en_US">
```

#### 2. **Twitter Card Meta Tags**
These tags control previews on Twitter/X and similar platforms.

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="https://biogradix.com/">
<meta name="twitter:title" content="biogradix — Donde la ciencia encuentra su potencial">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="https://biogradix.com/og-image.png">
<meta name="twitter:creator" content="@biogradix">
```

#### 3. **Canonical URLs**
Prevents duplicate content issues and directs search engines to the primary version.

```html
<link rel="canonical" href="https://biogradix.com/">
```

---

## 📄 Pages with Metadata

### **index.html** (Home)
- **Title**: biogradix — Donde la ciencia encuentra su potencial
- **Description**: Bioactivos de grado farmacéutico para el mercado mexicano...
- **Image**: https://biogradix.com/og-image.png
- **URL**: https://biogradix.com/

### **educacion.html** (Education)
- **Title**: biogradix — Educación y Recursos
- **Description**: Guías, FAQ, videos de capacitación y recursos científicos...
- **Image**: https://biogradix.com/og-image-educacion.png
- **URL**: https://biogradix.com/educacion.html

### **tecnologia.html** (Technology)
- **Title**: biogradix — Tecnología NuePatch
- **Description**: NuePatch: parche bucal con tecnología LaminaCore®...
- **Image**: https://biogradix.com/og-image-tecnologia.png
- **URL**: https://biogradix.com/tecnologia.html

### **blog.html** (Blog)
- **Base Title**: biogradix — Blog
- **Base Description**: Artículos sobre ciencia de péptidos...
- **Base Image**: https://biogradix.com/og-image-blog.png
- **Dynamic**: When opening articles, metadata updates with article title, description, and image
- **URL**: https://biogradix.com/blog.html?post=[id]

---

## 🔄 Dynamic Blog Article Metadata

Blog articles automatically update metadata when opened:

```javascript
window.openBlogArticle = function(id) {
  // ... article opens in modal
  
  // Meta tags update dynamically:
  document.title = `${title} — biogradix Blog`;
  document.querySelector('meta[name="description"]').setAttribute('content', excerpt);
  document.querySelector('meta[property="og:title"]').setAttribute('content', title);
  document.querySelector('meta[property="og:image"]').setAttribute('content', post.image);
  // ... etc
};
```

**Result**: When someone shares a blog article link on WhatsApp, Facebook, or Twitter, the preview shows the article title, excerpt, and featured image — not just the blog page.

---

## 🧪 How to Test Social Metadata

### **Facebook / WhatsApp**
1. Go to: https://developers.facebook.com/tools/debug/
2. Enter your biogradix URL
3. Click "Debug" to see the preview
4. View how the link appears when shared

### **Twitter / X**
1. Go to: https://cards-dev.twitter.com/validator
2. Enter your biogradix URL
3. See the live Twitter Card preview
4. Verify title, description, and image

### **LinkedIn**
1. Go to: https://www.linkedin.com/feed/
2. Paste the biogradix URL in a post
3. LinkedIn will fetch and display the preview

### **WhatsApp**
1. Open WhatsApp Web (https://web.whatsapp.com)
2. Paste the biogradix URL in a chat
3. WhatsApp will display the preview with title, description, and image

---

## 🖼️ Required Images

To display proper previews, ensure these images exist:

| Page | Image Path | Size | Recommended |
|------|-----------|------|-----------|
| Home | `/og-image.png` | 1200×630px | Brand/hero image |
| Education | `/og-image-educacion.png` | 1200×630px | Educational content |
| Technology | `/og-image-tecnologia.png` | 1200×630px | NuePatch technology |
| Blog | `/og-image-blog.png` | 1200×630px | Blog featured image |
| Blog Articles | `${post.image}` | 1200×630px | Article featured image |

**Optimal Image Specs:**
- Format: PNG or JPG
- Dimensions: 1200×630 pixels (16:9 aspect ratio)
- File size: < 1 MB (for fast loading)
- Content: Clear, on-brand, relevant to page topic

---

## 📋 Metadata Checklist

### **All Pages**
- ✅ `<meta name="description">` — Page summary (160 characters max)
- ✅ `<meta name="keywords">` — Relevant search terms
- ✅ `<meta name="author">` — "biogradix"
- ✅ `<meta name="robots">` — "index, follow"

### **Open Graph**
- ✅ `og:type` — "website"
- ✅ `og:url` — Full page URL
- ✅ `og:title` — Page title (70 characters max)
- ✅ `og:description` — Page summary (160 characters max)
- ✅ `og:image` — 1200×630px image
- ✅ `og:site_name` — "biogradix"
- ✅ `og:locale` — "es_MX" (Spanish-primary)
- ✅ `og:locale:alternate` — "en_US" (English alternative)

### **Twitter Card**
- ✅ `twitter:card` — "summary_large_image"
- ✅ `twitter:url` — Full page URL
- ✅ `twitter:title` — Page title
- ✅ `twitter:description` — Page summary
- ✅ `twitter:image` — 1200×630px image
- ✅ `twitter:creator` — "@biogradix"

### **Other**
- ✅ `<link rel="canonical">` — Prevents duplicate content

---

## 🚀 Why This Matters

When people share biogradix links on social media:

1. **Facebook**: Shows rich preview with title, description, and image
2. **WhatsApp**: Displays same preview as Facebook
3. **LinkedIn**: Professional preview for network sharing
4. **Twitter/X**: Large image card format
5. **Email**: Some email clients parse metadata for previews

**Impact**:
- Higher click-through rates (CTR)
- Better social media engagement
- Professional appearance
- Improved brand consistency
- Tracking: Blog article links include `?post=[id]` for analytics

---

## 💡 Do We Need Cloudflare?

**Short Answer**: Not required for metadata to work, but Cloudflare helps with:

### **Cloudflare Benefits (Optional)**
1. **Caching**: Faster page loads globally
2. **CDN**: Images serve from edge servers near users
3. **Security**: DDoS protection, bot blocking
4. **Monitoring**: See which links are shared most
5. **Compression**: Automatic image/CSS compression

### **Without Cloudflare**
- Metadata still works perfectly
- Pages serve fine from GitHub Pages
- Social previews work normally
- Just slower for international users (optional optimization)

**Recommendation**: Start without Cloudflare. Add it later if:
- You need faster international performance
- You want to track social shares
- You need advanced security features

---

## 📊 Testing Checklist

After deployment:

- [ ] Test home page link in WhatsApp
- [ ] Test blog article link in WhatsApp
- [ ] Test home page in Facebook debugger
- [ ] Test blog article in Twitter Card validator
- [ ] Verify images display correctly in previews
- [ ] Check that article titles/descriptions appear
- [ ] Test language toggle doesn't break metadata

---

## 🔗 Useful Tools

| Tool | URL | Purpose |
|------|-----|---------|
| Facebook Debugger | https://developers.facebook.com/tools/debug/ | Test Open Graph metadata |
| Twitter Card Validator | https://cards-dev.twitter.com/validator | Test Twitter/X previews |
| LinkedIn Post Inspector | https://www.linkedin.com/feed/ | Test LinkedIn previews |
| SEO Meta Tags Checker | https://www.smallseotools.com/meta-tags-analyzer/ | Analyze all metadata |

---

## 📝 Next Steps

1. **Create/Upload OG Images**:
   - Design 4 branded images (1200×630px)
   - Save to repository as PNG files
   - Link in meta tags

2. **Test All Links**:
   - Use tools above to verify previews
   - Test on different devices
   - Test with different browsers

3. **Monitor Sharing**:
   - Track which pages are shared most
   - Monitor click-through rates
   - Adjust descriptions/images if needed

4. **Maintain Consistency**:
   - Update descriptions when page content changes
   - Keep brand messaging consistent
   - Refresh images periodically for campaigns

---

**Last Updated**: April 2, 2026  
**Status**: ✅ Complete and deployed to GitHub  
**Next Steps**: Create/upload OG images and test on social platforms
