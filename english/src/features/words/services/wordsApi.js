import {
  clearAuthSession,
  getAuthHeaders,
  getAuthToken,
} from "../../auth/services/authApi";

const API_URL = import.meta.env.VITE_API_URL ?? "http://45.93.139.211:5001/api";

export class AuthRequiredError extends Error {
  constructor(message = "Zaloguj się, żeby zapisywać zmiany.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

function requireAuthHeaders() {
  if (!getAuthToken()) {
    throw new AuthRequiredError();
  }

  return getAuthHeaders();
}

async function throwApiError(response, fallbackMessage) {
  let message = fallbackMessage;

  try {
    const data = await response.json();
    message = data.error || message;
  } catch {
    // Some endpoints may return an empty or non-JSON error body.
  }

  if (response.status === 401) {
    clearAuthSession();
    throw new AuthRequiredError(message);
  }

  throw new Error(message);
}

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
      ...requireAuthHeaders(),
    },
    body: JSON.stringify({ baseId, baseName, english, polish }),
  });

  if (!response.ok) {
    await throwApiError(response, "Nie udało się dodać słowa.");
  }

  return response.json();
}

export async function translateWord({ english, sentence }) {
  const response = await fetch(`${API_URL}/translate-word`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ english, sentence }),
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
      ...requireAuthHeaders(),
    },
    body: JSON.stringify({ baseId, baseName, words }),
  });

  if (!response.ok) {
    await throwApiError(response, "Nie udało się zapisać słów.");
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
      ...requireAuthHeaders(),
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    await throwApiError(response, "Nie udało się utworzyć bazy.");
  }

  return response.json();
}

export async function deleteWordBase(id) {
  const response = await fetch(`${API_URL}/word-bases/${id}`, {
    method: "DELETE",
    headers: requireAuthHeaders(),
  });

  if (!response.ok) {
    await throwApiError(response, "Nie udało się usunąć bazy.");
  }

  return response.json();
}

export async function deleteWords(ids) {
  const response = await fetch(`${API_URL}/words`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...requireAuthHeaders(),
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    await throwApiError(response, "Nie udało się usunąć słów.");
  }

  return response.json();
}

export async function updateWord(id, { baseId, baseName, english, polish }) {
  const response = await fetch(`${API_URL}/words/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...requireAuthHeaders(),
    },
    body: JSON.stringify({ baseId, baseName, english, polish }),
  });

  if (!response.ok) {
    await throwApiError(response, "Nie udało się zaktualizować słowa.");
  }

  return response.json();
}

export async function saveStudyCycle({ baseId, cycleNumber, wordIds }) {
  const response = await fetch(`${API_URL}/study-cycles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requireAuthHeaders(),
    },
    body: JSON.stringify({ baseId, cycleNumber, wordIds }),
  });

  if (!response.ok) {
    await throwApiError(response, "Nie udało się zapisać cyklu nauki.");
  }

  return response.json();
}

export async function fetchStudyCycleStatus({ baseId } = {}) {
  const params = new URLSearchParams();

  if (baseId) {
    params.set("base_id", String(baseId));
  }

  const query = params.toString();
  const response = await fetch(
    `${API_URL}/study-cycles/status${query ? `?${query}` : ""}`,
    {
      headers: requireAuthHeaders(),
    }
  );

  if (!response.ok) {
    await throwApiError(response, "Nie udało się pobrać statusu cykli.");
  }

  return response.json();
}

export async function fetchStudyStats() {
  const response = await fetch(`${API_URL}/study-sessions/stats`, {
    headers: requireAuthHeaders(),
  });

  if (!response.ok) {
    await throwApiError(response, "Nie udało się pobrać statystyk nauki.");
  }

  return response.json();
}
