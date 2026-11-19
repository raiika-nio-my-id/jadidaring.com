# News article body format

Bodies are plain text blocks separated by blank lines (HTML is always escaped):

- `Poin penting` + `- ` bullet lines (3-4 facts taken from the article) renders the key-points box. Put it first.
- `## Heading` / `### Subheading` as their own block; use one `##` roughly every 2-3 paragraphs.
- `**bold**` inline, sparingly (1-3 per section) on numbers, names, dates.
- A block made only of `- ` lines renders a bullet list.

`POST /api/admin/news/articles` returns a `warnings` array when the body lacks a `##` heading or the key-points box.
`GET /api/admin/news/articles?full=1` includes `body` and `summary`.

## Article images

Every article has an image. Without a photo, the site serves a branded title card that it draws itself
(no AI image model). A free-licensed photo can replace it at any time, for existing and new articles.

Rules: only free-licensed photos (Unsplash, Pexels, Wikimedia Commons / Creative Commons). Never copyrighted
news photos. The server downloads and self-hosts the photo (never hotlinked), crops it to 1200x630 and stores
webp copies at 480/800/1200px. The source file must be at least **1200x630 px**, JPEG/PNG/WebP/GIF, up to 12 MB.
The credit line is shown under the image on the article page.

Attach a photo to an existing article (header `X-Admin-Api-Key`, host `admin.jadidaring.com`):

```
POST /api/admin/news/articles/{id}/image
  # either a file upload (multipart/form-data) ...
  image=@photo.jpg
  # ... or a URL the server downloads (https only, public hosts only)
  image_url=https://images.unsplash.com/photo-....jpg
  # required for both:
  alt=Deskripsi singkat isi foto (5-200 karakter)
  credit=Nama fotografer / Unsplash
  source_url=https://unsplash.com/photos/....        (page where the photo and its license live)
  license=Unsplash License                           (e.g. CC BY-SA 4.0, CC0, Pexels License)
```

Returns `{"article": {..., "image": {"photo": true, "alt", "credit", "source_url", "license", "url"}}}`.
`422` with a clear message if the image is too small, not an image, or the URL is not a public https image.
`DELETE /api/admin/news/articles/{id}/image` goes back to the title card.

When creating an article you can include the photo in the same call:
`"image": {"url": "https://...", "alt": "...", "credit": "...", "source_url": "https://...", "license": "..."}`.
If the download fails the article is still created and the response has `image_error`.
`GET /api/admin/news/articles` shows `has_photo` per article.

## Feeds and SEO

`/berita/rss.xml` (RSS), `/news-sitemap.xml` (articles from the last 2 days) and `/sitemap.xml` (real `lastmod`
per page) update by themselves. `/berita?q=` searches titles and summaries.
