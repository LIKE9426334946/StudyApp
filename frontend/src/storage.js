const FAVORITES_KEY = "studyapp:favorites";
const STUDY_DATA_KEY = "studyapp:study-data:v1";

export function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.map(Number) : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
}

export function loadStudyData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STUDY_DATA_KEY) || "null");

    if (
      !saved ||
      !Array.isArray(saved.functions) ||
      !Array.isArray(saved.libraries) ||
      !Array.isArray(saved.directories)
    ) {
      return null;
    }

    return {
      functions: saved.functions,
      libraries: saved.libraries,
      directories: saved.directories,
    };
  } catch {
    return null;
  }
}

export function saveStudyData(data) {
  try {
    localStorage.setItem(
      STUDY_DATA_KEY,
      JSON.stringify({
        functions: data.functions,
        libraries: data.libraries,
        directories: data.directories,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

