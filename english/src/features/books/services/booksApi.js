const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

export async function fetchBooks() {
  const response = await fetch(`${API_URL}/books`);

  if (!response.ok) {
    throw new Error("Nie udało się pobrać książek.");
  }

  return response.json();
}

export function getBookPreviewUrl(filename) {
  return `${API_URL}/books/${encodeURIComponent(filename)}`;
}

export function getBookPagePreviewUrl(filename, page) {
  return `${API_URL}/books/${encodeURIComponent(filename)}/pages/${page}`;
}

export async function fetchBookPageWords(filename, page) {
  const response = await fetch(
    `${API_URL}/books/${encodeURIComponent(filename)}/pages/${page}/words`
  );

  if (!response.ok) {
    throw new Error("Nie udało się odczytać słów ze strony.");
  }

  return response.json();
}
