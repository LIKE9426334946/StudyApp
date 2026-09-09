const FAVORITES_KEY = "studyapp:favorites";
const STUDY_DATA_KEY = "studyapp:study-data:v1";
const REVIEWED_LIBRARIES_KEY = "studyapp:reviewed-libraries";

function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.flatMap((id) => {
      if (typeof id === "string" && /^\d+$/.test(id)) id = Number(id);
      return (typeof id === "string" || (Number.isSafeInteger(id) && id > 0)) ? [id] : [];
    }) : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites(favorites) {
  return saveLocal(FAVORITES_KEY, [...favorites]);
}

export function loadReviewedLibraries() {
  try {
    const saved = JSON.parse(localStorage.getItem(REVIEWED_LIBRARIES_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.filter((name) => typeof name === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveReviewedLibraries(libraries) {
  return saveLocal(REVIEWED_LIBRARIES_KEY, [...libraries]);
}

function validStudyData(saved) {
  return saved && Array.isArray(saved.functions) && Array.isArray(saved.libraries) && Array.isArray(saved.directories);
}

function legacyStudyData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STUDY_DATA_KEY) || "null");
    return validStudyData(saved) ? saved : null;
  } catch {
    return null;
  }
}

function studyDatabase(mode, value) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("浏览器不支持离线缓存"));
    const request = indexedDB.open("studyapp-cache", 1);
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error("打开离线缓存超时"));
    }, 5000);
    const fail = () => { clearTimeout(timeout); settled = true; reject(request.error || new Error("无法打开离线缓存")); };
    request.onerror = fail;
    request.onblocked = () => { clearTimeout(timeout); settled = true; reject(new Error("离线缓存被其他页面占用")); };
    request.onupgradeneeded = () => request.result.createObjectStore("study");
    request.onsuccess = () => {
      clearTimeout(timeout);
      const db = request.result;
      if (settled) { db.close(); return; }
      try {
        const transaction = db.transaction("study", mode);
        const store = transaction.objectStore("study");
        const operation = mode === "readonly" ? store.get("data") : store.put(value, "data");
        transaction.oncomplete = () => { db.close(); resolve(operation.result); };
        transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error || new Error("离线缓存保存失败")); };
      } catch (error) {
        db.close();
        reject(error);
      }
    };
  });
}

export async function loadStudyData() {
  let cached;
  try { cached = await studyDatabase("readonly"); } catch { /* Read legacy cache below. */ }
  const legacy = legacyStudyData();
  // A fallback localStorage write may be newer than the IndexedDB snapshot.
  if (validStudyData(cached) && (!legacy || (Date.parse(cached.refreshedAt) || 0) >= (Date.parse(legacy.refreshedAt) || 0))) return cached;
  if (legacy) {
    try {
      await studyDatabase("readwrite", legacy);
      localStorage.removeItem(STUDY_DATA_KEY);
    } catch { /* Keep the legacy copy until migration succeeds. */ }
  }
  return legacy;
}

export async function saveStudyData(data) {
  const snapshot = {
    functions: data.functions,
    libraries: data.libraries,
    directories: data.directories,
    refreshedAt: data.refreshedAt,
  };
  try {
    await studyDatabase("readwrite", snapshot);
    try { localStorage.removeItem(STUDY_DATA_KEY); } catch { /* IndexedDB is already saved. */ }
    return true;
  } catch {
    return saveLocal(STUDY_DATA_KEY, snapshot);
  }
}
