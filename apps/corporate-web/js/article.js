// A single news article: article.html?slug=...  Text only; the body is split into paragraphs on blank lines.
import { api } from './api.js';

const root = document.getElementById('article');
const status = document.getElementById('article-status');
const slug = new URLSearchParams(location.search).get('slug') || '';

function missing() {
  status.hidden = true;
  document.getElementById('article-missing').hidden = false;
}

if (!slug) missing();
else {
  api.article(slug).then(
    a => {
      status.hidden = true;
      document.title = `${a.title} | Ariyoo`;
      root.querySelector('.date').textContent = new Date(a.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      root.querySelector('h1').textContent = a.title;
      root.querySelector('.lede').textContent = a.summary;
      const body = root.querySelector('[data-body]');
      for (const para of a.body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)) {
        const p = document.createElement('p');
        p.textContent = para;
        body.append(p);
      }
      root.hidden = false;
    },
    error => {
      if (error.status === 404) return missing();
      status.textContent = 'We could not load this article. Please try again shortly.';
      status.className = 'notice notice--bad';
      status.setAttribute('role', 'alert');
    },
  );
}
