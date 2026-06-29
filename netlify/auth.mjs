// Admin PIN resolution + validation, shared by the API functions.
// The ADMIN_PIN environment variable is the source of truth; we fall back to the
// pin stored in state only for back-compat (e.g. before the env var is set).
export function adminPin(state){
  return Netlify.env.get("ADMIN_PIN") || state?.pin || "";
}
export function pinOk(pin, state){
  const p = adminPin(state);
  return !!p && String(pin) === String(p);
}
