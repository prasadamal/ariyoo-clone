// Turns a failed request into a sentence a visitor can act on, plus messages per field.
export function problemFrom(status, body) {
  if (status === 0) return { message: 'We could not reach our servers. Please check your connection and try again, or email us.', fields: {} };
  if (status === 429) return { message: 'Too many requests. Please wait a minute and try again.', fields: {} };
  const fields = body && typeof body.fields === 'object' && body.fields ? body.fields : {};
  const message = body && typeof body.message === 'string' ? body.message : 'Something went wrong. Please try again.';
  return { message, fields };
}
