const PROD_ICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%237c9cff'/><circle cx='50' cy='50' r='18' fill='%231a1d23'/></svg>";

const LOCAL_ICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23ffb454'/><path d='M50 22 L79 75 L21 75 Z' fill='%231a1d23'/></svg>";

/** Локальная/тестовая среда: dev-сервер или приватный адрес. */
function isLocalHost(host: string): boolean {
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return true;
  if (host.endsWith('.local')) return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

/** Разные иконка и заголовок для локальной и боевой версии, чтобы не путать вкладки. */
export function applyBranding() {
  const local = import.meta.env.DEV || isLocalHost(window.location.hostname);
  const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (icon) icon.href = local ? LOCAL_ICON : PROD_ICON;
  document.title = local ? 'D&D VTT — local' : 'D&D VTT';
}
