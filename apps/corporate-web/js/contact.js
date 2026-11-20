// Contact page: the contact form.
import { api } from './api.js';
import { bindForm } from './forms.js';
import { validateContact } from './lib/validate.js';

const form = document.getElementById('contact-form');
const thanks = document.getElementById('contact-thanks');

bindForm(form, {
  validate: validateContact,
  send: v => api.contact({
    name: v.name.trim(),
    email: v.email.trim(),
    topic: v.topic,
    organisation: v.organisation.trim() || undefined,
    message: v.message.trim(),
    website: v.website,
  }),
  done: v => {
    thanks.querySelector('[data-email]').textContent = v.email.trim();
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus();
  },
});

// Links like contact.html?topic=investor preselect the topic.
const topic = new URLSearchParams(location.search).get('topic');
if (topic && form.topic.querySelector(`option[value="${CSS.escape(topic)}"]`)) form.topic.value = topic;
