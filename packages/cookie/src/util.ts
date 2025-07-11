// Read a cookie by name
export function getCookie(name: string): string | null {
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i]?.trim();
    if (cookie?.startsWith(name + '=')) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}

// Write a cookie with a given name, value, and expiration date
export function setCookie(name: string, value: string, expires?: Date): void {
  let cookie = `${name}=${value}`;
  if (expires) {
    cookie += `;expires=${expires.toUTCString()};Path=/`;
  }
  document.cookie = cookie;
}
