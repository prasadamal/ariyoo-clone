// Public config for the Wayfare web viewers (shared journeys + live location).
// Use the same values as EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.
// The anon key is meant to be public: row-level security and the read-only RPCs
// (get_shared_trip, get_live_share) decide what a link can see.
window.WAYFARE_CONFIG = {
  supabaseUrl: 'https://ujtylwimukufmbungnju.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdHlsd2ltdWt1Zm1idW5nbmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MTczMjQsImV4cCI6MjEwNjI5MzMyNH0.CJPE_jPoEHbu0UC9GxYyAlk0IkxPZCSBjem26X3mj1w',
};

// Small helpers shared by the viewers (no innerHTML with user content anywhere).
window.wayfareRpc = async function (fn, args) {
  const cfg = window.WAYFARE_CONFIG;
  if (!cfg || cfg.supabaseUrl.includes('YOUR_PROJECT')) {
    throw new Error('This viewer is not configured yet (docs/wayfare-config.js).');
  }
  const res = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.supabaseAnonKey,
      Authorization: 'Bearer ' + cfg.supabaseAnonKey,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error('Could not load (' + res.status + ')');
  return res.json();
};

window.wayfareEl = function (tag, attrs) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (let i = 2; i < arguments.length; i++) {
    const child = arguments[i];
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};
