import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPhotoBookHtml, chunkPages } from '../photoBookHtml';

const img = 'data:image/jpeg;base64,AAAA';

test('two photos per page at most; moments without photos are skipped; caption on the first', () => {
  const pages = chunkPages([
    { date: '20 Nov', caption: 'Beach day', images: [img, img, img] },
    { date: '21 Nov', caption: 'Just words', images: [] },
  ]);
  assert.deepEqual(pages.map(p => [p.images.length, p.caption]), [[2, 'Beach day'], [1, '']]);
});

test('text is escaped and only image data or https sources are used', () => {
  const html = buildPhotoBookHtml({
    title: 'Goa <script>',
    subtitle: '22–26 Nov',
    cover: 'javascript:alert(1)',
    pages: [{ date: '22 Nov', caption: 'Fish & chips "here"', images: [img, 'file:///secret.jpg'] }],
  });
  assert.match(html, /Goa &lt;script&gt;/);
  assert.match(html, /Fish &amp; chips &quot;here&quot;/);
  assert.doesNotMatch(html, /javascript:|file:\/\//);
  assert.match(html, /coverimg plain/);
  assert.equal((html.match(/<img src=/g) ?? []).length, 1);
});
