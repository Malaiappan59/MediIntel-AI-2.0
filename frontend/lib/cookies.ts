type CookieOptions = {
  days?: number;
  path?: string;
};

export function setCookie(name: string, value: string, options: CookieOptions = {}) {
  if (typeof document === "undefined") {
    return;
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + (options.days ?? 1));

  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=${options.path ?? "/"}; SameSite=Lax`;
}

export function getCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

