// Small helpers for talking to the RoarMart server.

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  search: (body, signal) => request('/api/search', { method: 'POST', body: JSON.stringify(body), signal }),
  product: (id) => request(`/api/products/${id}`),
  catalog: () => request('/api/catalog'),
  suggest: (q, signal) => request(`/api/suggest?q=${encodeURIComponent(q)}`, { signal }),
  get: (url) => request(url),
  post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body || {}) }),
  del: (url) => request(url, { method: 'DELETE' }),
};
