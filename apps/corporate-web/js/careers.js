// Careers page: open roles from the API and the application form.
import { api } from './api.js';
import { bindForm } from './forms.js';
import { validateApplication } from './lib/validate.js';

const status = document.getElementById('roles-status');
const list = document.getElementById('roles');
const empty = document.getElementById('roles-empty');
const heading = document.getElementById('apply-heading');
const general = document.getElementById('apply-general');
const form = document.getElementById('apply-form');
const thanks = document.getElementById('apply-thanks');
let role = null;

function setRole(job) {
  role = job;
  heading.textContent = job ? `Apply: ${job.title}` : 'Open application';
  general.hidden = !job;
}

// Built with textContent only: role text from the API is never treated as HTML.
function card(job) {
  const article = document.createElement('article');
  article.className = 'card role';
  const text = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = job.title;
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `${job.team} · ${job.location} · ${job.employment}`;
  const summary = document.createElement('p');
  summary.textContent = job.summary;
  text.append(title, meta, summary);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--primary';
  button.textContent = 'Apply for this role';
  button.addEventListener('click', () => {
    setRole(job);
    document.getElementById('apply').scrollIntoView({ block: 'start' });
    // form.name would be the form's own name attribute, not the field, so look the field up.
    form.elements.namedItem('name').focus({ preventScroll: true });
  });
  article.append(text, button);
  return article;
}

api.jobs().then(
  jobs => {
    status.hidden = true;
    if (!jobs.length) {
      empty.hidden = false;
      return;
    }
    list.append(...jobs.map(card));
    list.hidden = false;
  },
  () => {
    status.textContent = 'We could not load our open roles just now. You can still send an open application below.';
    status.className = 'notice notice--bad';
    status.setAttribute('role', 'alert');
  },
);

general.querySelector('button').addEventListener('click', () => setRole(null));

bindForm(form, {
  validate: validateApplication,
  send: v => api.apply({
    jobSlug: role ? role.slug : undefined,
    name: v.name.trim(),
    email: v.email.trim(),
    profileUrl: v.profileUrl.trim(),
    message: v.message.trim(),
    website: v.website,
  }),
  done: () => {
    form.hidden = true;
    general.hidden = true;
    thanks.hidden = false;
    thanks.focus();
  },
});
