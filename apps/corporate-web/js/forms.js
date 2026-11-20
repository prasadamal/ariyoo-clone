// Connects a <form> to its checks and its API call. Shows messages beside each field, keeps what
// was typed when sending fails, and never sends twice from a double click.

function values(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showErrors(form, errors) {
  for (const field of form.querySelectorAll('.field')) {
    const input = field.querySelector('input, select, textarea');
    const message = field.querySelector('.field-error');
    const error = input && errors[input.name];
    field.classList.toggle('has-error', Boolean(error));
    if (input) input.setAttribute('aria-invalid', error ? 'true' : 'false');
    if (message) {
      message.textContent = error || '';
      message.hidden = !error;
    }
  }
}

/**
 * @param form the <form>
 * @param validate (values) => { field: message }
 * @param send (values) => Promise
 * @param done (values) => void, after a successful send
 */
export function bindForm(form, { validate, send, done }) {
  const button = form.querySelector('button[type="submit"]');
  const label = button.textContent;
  const banner = form.querySelector('[data-form-error]');
  let busy = false;

  form.noValidate = true;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const v = values(form);
    const errors = validate(v);
    showErrors(form, errors);
    if (banner) banner.hidden = true;
    const first = Object.keys(errors)[0];
    if (first) {
      form.querySelector(`[name="${first}"]`)?.focus();
      return;
    }
    busy = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await send(v);
      done(v);
    } catch (error) {
      const problem = error.problem || { message: 'Something went wrong. Please try again.', fields: {} };
      showErrors(form, problem.fields);
      if (banner) {
        banner.textContent = problem.message;
        banner.hidden = false;
      }
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = label;
    }
  });
}
