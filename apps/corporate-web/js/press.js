// Press page: published news from the API.
import { api } from './api.js';

const status = document.getElementById('press-status');
const list = document.getElementById('press-list');
const empty = document.getElementById('press-empty');
const date = iso => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

api.press().then(
  items => {
    status.hidden = true;
    if (!items.length) {
      empty.hidden = false;
      return;
    }
    for (const item of items) {
      const article = document.createElement('article');
      article.className = 'card';
      const when = document.createElement('p');
      when.className = 'date';
      when.textContent = date(item.publishedAt);
      const h2 = document.createElement('h2');
      const link = document.createElement('a');
      link.href = 'article.html?slug=' + encodeURIComponent(item.slug);
      link.textContent = item.title;
      h2.append(link);
      const summary = document.createElement('p');
      summary.textContent = item.summary;
      article.append(when, h2, summary);
      list.append(article);
    }
    list.hidden = false;
  },
  () => {
    status.textContent = 'We could not load our news just now. Please try again shortly.';
    status.className = 'notice notice--bad';
    status.setAttribute('role', 'alert');
  },
);
