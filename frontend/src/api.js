const FUNCTIONS_ENDPOINT = "api/functions";

async function request(path = "", options = {}) {
  const response = await fetch(`${FUNCTIONS_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `请求失败（${response.status}）`);
  }

  return data;
}

export function getFunctions() {
  return request();
}

export function createFunction(payload) {
  return request("", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateFunction(id, payload) {
  return request(`/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteFunction(id) {
  return request(`/${id}`, {
    method: "DELETE",
  });
}

export async function exportFunctions() {
  const response = await fetch(`${FUNCTIONS_ENDPOINT}/export`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || `导出失败（${response.status}）`);
  }

  return response.blob();
}

export function importFunctions(functions) {
  return request("/import", {
    method: "POST",
    body: JSON.stringify(functions),
  });
}
