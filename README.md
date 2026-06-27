# ganchengguang.github.io

Personal academic website of **Chengguang Gan (甘程光)** — LLM Researcher at Techtouch.

🔗 Live: https://ganchengguang.github.io

## Stack

A lightweight, dependency-free static site — no build step, no Jekyll.

```
index.html              # the whole page (semantic, SEO-friendly)
assets/css/style.css    # theme (light/dark via CSS variables), layout, responsive
assets/js/main.js       # theme toggle, mobile nav, publication filters, scroll reveal
assets/img/             # profile photo + favicon
visitor-worker/         # Cloudflare Worker + D1 backend for the visitor map
.nojekyll               # tell GitHub Pages to serve files as-is (skip Jekyll)
```

Icons come from [Font Awesome](https://fontawesome.com/) and
[Academicons](https://jpswalsh.github.io/academicons/) via CDN; fonts from Google Fonts.

## Editing

- **Add a publication** — copy one `<li class="pub" ...>` block inside `<ol id="pubs">`
  in `index.html`, set `data-type` (`conference` / `journal` / `preprint` / `domestic`)
  and `data-year`, then fill in the title, authors (wrap your own name in `<strong>`),
  venue, and link.
- **Add a news item** — add an `<li>` to the `<ul class="news">` list.
- **Update bio / experience / education** — edit the corresponding section in `index.html`.
- **Swap the photo** — replace `assets/img/profile.png`.

## Local preview

```bash
python -m http.server 4173
# open http://localhost:4173
```

## Visitor map

The footer visitor map is static-site friendly: GitHub Pages serves the UI, and
`visitor-worker/` provides the IP logging API and private admin dashboard via
Cloudflare Workers + D1.

Deploy the Worker first, then set `data-api-base` on `#visitorMap` in
`index.html` to the Worker URL. Full steps are in
[`visitor-worker/README.md`](visitor-worker/README.md).

## Deploy

Hosted on GitHub Pages from the `master` branch. Pushing to `master` publishes the site.
