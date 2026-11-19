# News article body format

Bodies are plain text blocks separated by blank lines (HTML is always escaped):

- `Poin penting` + `- ` bullet lines (3-4 facts taken from the article) renders the key-points box. Put it first.
- `## Heading` / `### Subheading` as their own block; use one `##` roughly every 2-3 paragraphs.
- `**bold**` inline, sparingly (1-3 per section) on numbers, names, dates.
- A block made only of `- ` lines renders a bullet list.

`POST /api/admin/news/articles` returns a `warnings` array when the body lacks a `##` heading or the key-points box.
`GET /api/admin/news/articles?full=1` includes `body` and `summary`.
