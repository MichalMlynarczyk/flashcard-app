const API_URL = import.meta.env.VITE_API_URL ?? "http://45.93.139.211:5001/api";
const RETRY_DELAYS_MS = [500, 1200];

export async function scanImage(imageFile, rotationDegrees) {
  const response = await fetchWithRetry(() => {
    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("rotation", String(rotationDegrees));

    return fetch(`${API_URL}/scan`, {
      method: "POST",
      body: formData,
    });
  });

  return response.blob();
}

export async function cropImage(points) {
  const response = await fetchWithRetry(() => fetch(`${API_URL}/crop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      points: points.map(({ x, y }) => ({ x, y })),
    }),
  }));

  return response.blob();
}

export async function extractWords() {
  const response = await fetchWithRetry(() => fetch(`${API_URL}/extract-words`, {
    method: "POST",
  }));

  return response.json();
}

async function fetchWithRetry(createRequest) {
  let lastError;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await createRequest();

      if (response.ok) {
        return response;
      }

      if (!shouldRetryStatus(response.status) || attempt === RETRY_DELAYS_MS.length) {
        throw new Error(await getResponseErrorMessage(response));
      }

      lastError = new Error(await getResponseErrorMessage(response));
    } catch (error) {
      lastError = error;

      if (attempt === RETRY_DELAYS_MS.length) {
        throw lastError;
      }
    }

    await delay(RETRY_DELAYS_MS[attempt]);
  }

  throw lastError ?? new Error("Nie udało się połączyć z serwerem.");
}

function shouldRetryStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function getResponseErrorMessage(response) {
  try {
    const data = await response.clone().json();
    return data.error || "Błąd serwera podczas skanowania.";
  } catch {
    return "Błąd serwera podczas skanowania.";
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
