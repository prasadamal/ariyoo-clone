import { API_BASE } from './config.js';
import { problemFrom } from './lib/problem.js';

/** A failed call. `problem` has a message to show and messages per field. */
export class ApiError extends Error {
  constructor(status, problem) {
    super(problem.message);
    this.status = status;
    this.problem = problem;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(API_BASE + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch {
    throw new ApiError(0, problemFrom(0));
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, problemFrom(res.status, body));
  return body;
}

export const api = {
  jobs: () => request('/jobs'),
  press: () => request('/press'),
  article: slug => request('/press/' + encodeURIComponent(slug)),
  contact: body => request('/contact', { method: 'POST', body: JSON.stringify(body) }),
  apply: body => request('/applications', { method: 'POST', body: JSON.stringify(body) }),
  subscribe: email => request('/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email }) }),
};
