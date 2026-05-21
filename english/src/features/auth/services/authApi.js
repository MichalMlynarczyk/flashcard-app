const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
export const AUTH_USER_STORAGE_KEY = "brainlift-auth-user";
export const AUTH_TOKEN_STORAGE_KEY = "brainlift-auth-token";
export const AUTH_SESSION_CHANGE_EVENT = "brainlift-auth-session-change";

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function getAuthHeaders() {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export function loadStoredUser() {
  try {
    const storedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

function notifyAuthSessionChange() {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGE_EVENT));
}

export function saveAuthSession({ token, user }) {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  notifyAuthSessionChange();
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  notifyAuthSessionChange();
}

export async function registerUser({ email, name, password }) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, name, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Nie udało się utworzyć konta.");
  }

  saveAuthSession(data);
  return data;
}

export async function loginUser({ email, password }) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Nie udało się zalogować.");
  }

  saveAuthSession(data);
  return data;
}

export async function logoutUser() {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  clearAuthSession();

  if (!response.ok) {
    throw new Error("Nie udało się wylogować.");
  }
}
