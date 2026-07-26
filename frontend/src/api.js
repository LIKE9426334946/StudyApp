const FUNCTIONS_ENDPOINT = "api/functions";
const LIBRARIES_ENDPOINT = "api/libraries";
const AUTH_ENDPOINT = "api/auth";

function notifyUnauthorized(response) {
  if (response.status === 401) {
    window.dispatchEvent(new Event("studyapp:unauthorized"));
  }
}

async function requestFrom(endpoint, path = "", options = {}) {
  const response = await fetch(`${endpoint}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return null;
  }

  notifyUnauthorized(response);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `请求失败（${response.status}）`);
  }

  return data;
}

function request(path = "", options = {}) {
  return requestFrom(FUNCTIONS_ENDPOINT, path, options);
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
    notifyUnauthorized(response);
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || `导出失败（${response.status}）`);
  }

  return response.blob();
}

export function importFunctions(functions, mode = "append") {
  return request(`/import?mode=${encodeURIComponent(mode)}`, {
    method: "POST",
    body: JSON.stringify(functions),
  });
}

export function getLibraries() {
  return requestFrom(LIBRARIES_ENDPOINT);
}

export function createLibrary(name) {
  return requestFrom(LIBRARIES_ENDPOINT, "", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateLibraryOrder(libraries) {
  return requestFrom(LIBRARIES_ENDPOINT, "/order", {
    method: "PUT",
    body: JSON.stringify({ libraries }),
  });
}

export function deleteLibrary(name) {
  return requestFrom(LIBRARIES_ENDPOINT, `/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export function getAdminSession() {
  return requestFrom(AUTH_ENDPOINT, "/session");
}

export function loginAdmin(username, password) {
  return requestFrom(AUTH_ENDPOINT, "/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logoutAdmin() {
  return requestFrom(AUTH_ENDPOINT, "/logout", {
    method: "POST",
  });
}
