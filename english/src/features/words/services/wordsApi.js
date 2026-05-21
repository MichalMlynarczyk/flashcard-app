import { getAuthHeaders } from "../../auth/services/authApi";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

export async function fetchWords({
  baseId,
  limit,
  page = 1,
  perPage = 20,
  search = "",
} = {}) {
  const params = new URLSearchParams();

  if (limit) {
    params.set("limit", String(limit));
  } else {
    params.set("page", String(page));
    params.set("per_page", String(perPage));
  }

  if (search.trim()) {
    params.set("search", search.trim());
  }

  if (baseId) {
    params.set("base_id", String(baseId));
  }

  const response = await fetch(`${API_URL}/words?${params.toString()}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać słów.");
  }

  return response.json();
}

export async function fetchAllWords({ baseId } = {}) {
  const firstPage = await fetchWords({ baseId, page: 1, perPage: 100 });
  const allWords = [...firstPage.words];

  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const data = await fetchWords({ baseId, page, perPage: 100 });
    allWords.push(...data.words);
  }

  return allWords;
}

export async function createWord({ baseId, baseName, english, polish }) {
  const response = await fetch(`${API_URL}/words`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ baseId, baseName, english, polish }),
  });

  if (!response.ok) {
    throw new Error("Nie udało się dodać słowa.");
  }

  return response.json();
}

export async function translateWord(english) {
  const response = await fetch(`${API_URL}/translate-word`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ english }),
  });

  if (!response.ok) {
    throw new Error("Nie udało się przetłumaczyć słowa.");
  }

  return response.json();
}

export async function createWordsBulk({ baseId, baseName, words }) {
  const response = await fetch(`${API_URL}/words/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ baseId, baseName, words }),
  });

  if (!response.ok) {
    throw new Error("Nie udało się zapisać słów.");
  }

  return response.json();
}

export async function fetchWordBases() {
  const response = await fetch(`${API_URL}/word-bases`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać baz.");
  }

  return response.json();
}

export async function createWordBase(name) {
  const response = await fetch(`${API_URL}/word-bases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error("Nie udało się utworzyć bazy.");
  }

  return response.json();
}

export async function deleteWords(ids) {
  const response = await fetch(`${API_URL}/words`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error("Nie udało się usunąć słów.");
  }

  return response.json();
}

export async function updateWord(id, { baseId, baseName, english, polish }) {
  const response = await fetch(`${API_URL}/words/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ baseId, baseName, english, polish }),
  });

  if (!response.ok) {
    throw new Error("Nie udało się zaktualizować słowa.");
  }

  return response.json();
}
