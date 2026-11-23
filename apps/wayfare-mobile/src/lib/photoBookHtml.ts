/**
 * A printable photo book of a journey: a cover, then one page per moment with photos (two at most
 * per page, so prints stay large) and its words as a caption. Pure HTML building, unit-tested;
 * photoBook.ts gathers the photos and prints it to PDF.
 */
export type BookPage = { date: string; caption: string; images: string[] };
export type Book = { title: string; subtitle: string; cover: string | null; pages: BookPage[] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Only image data or http(s) addresses go into the page (never anything that could run). */
const safeSrc = (src: string) => (/^(data:image\/(jpeg|png|webp);base64,|https:\/\/)/.test(src) ? src.replace(/"/g, '%22') : '');

export function chunkPages(pages: BookPage[]): BookPage[] {
  const out: BookPage[] = [];
  for (const p of pages) {
    if (!p.images.length) continue;
    for (let i = 0; i < p.images.length; i += 2) out.push({ ...p, caption: i ? '' : p.caption, images: p.images.slice(i, i + 2) });
  }
  return out;
}

export function buildPhotoBookHtml(book: Book): string {
  const pages = chunkPages(book.pages);
  const cover = book.cover && safeSrc(book.cover) ? `<img class="coverimg" src="${safeSrc(book.cover)}"/>` : '<div class="coverimg plain"></div>';
  const body = pages
    .map(p => {
      const imgs = p.images.map(src => safeSrc(src)).filter(Boolean);
      return `<section class="page ${imgs.length === 2 ? 'two' : 'one'}">
        ${imgs.map(src => `<img src="${src}"/>`).join('')}
        <div class="cap"><time>${esc(p.date)}</time>${p.caption ? `<p>${esc(p.caption)}</p>` : ''}</div>
      </section>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #2b2230; }
    .page, .cover { width: 210mm; height: 297mm; page-break-after: always; position: relative; overflow: hidden; padding: 14mm; }
    .cover { padding: 0; }
    .coverimg { width: 100%; height: 70%; object-fit: cover; display: block; }
    .coverimg.plain { background: linear-gradient(135deg, #7a14b8, #fe9f41); }
    .covertext { padding: 14mm; }
    .covertext h1 { font-size: 34pt; margin: 0 0 4mm; }
    .covertext p { font-size: 13pt; color: #6b5a78; margin: 0; }
    .brand { position: absolute; bottom: 12mm; left: 14mm; font-family: system-ui, sans-serif; color: #6a01a3; font-weight: 700; font-size: 10pt; letter-spacing: .08em; }
    .page img { width: 100%; object-fit: cover; border-radius: 3mm; display: block; }
    .page.one img { height: 205mm; }
    .page.two img { height: 118mm; margin-bottom: 5mm; }
    .cap { margin-top: 5mm; }
    .cap time { font-family: system-ui, sans-serif; font-size: 9pt; letter-spacing: .06em; color: #8a7a96; text-transform: uppercase; }
    .cap p { font-size: 12pt; line-height: 1.5; margin: 2mm 0 0; }
  </style></head><body>
    <section class="cover">${cover}<div class="covertext"><h1>${esc(book.title)}</h1><p>${esc(book.subtitle)}</p></div><div class="brand">A WAYFARE PHOTO BOOK</div></section>
    ${body || '<section class="page"><p>No photos in this journey yet.</p></section>'}
  </body></html>`;
}
