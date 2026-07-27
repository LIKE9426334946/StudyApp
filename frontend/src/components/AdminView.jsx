import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDirectory,
  createFunction,
  createLibrary,
  deleteDirectory,
  deleteFunction,
  deleteLibrary,
  exportFunctions,
  getDirectories,
  getLibraries,
  importFunctions,
  updateLibraryDirectory,
  updateLibraryOrder,
  updateFunction,
} from "../api";

const EMPTY_FORM = {
  library: "",
  name: "",
  description: "",
  parameters: "",
  code: "",
  result: "",
};

const MAX_JSON_FILE_SIZE = 50 * 1024 * 1024;

function AdminView({ functions, onRefresh }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [importMode, setImportMode] = useState("append");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferError, setTransferError] = useState("");
  const [libraries, setLibraries] = useState([]);
  const [directories, setDirectories] = useState([]);
  const [newDirectory, setNewDirectory] = useState("");
  const [directorySaving, setDirectorySaving] = useState(false);
  const [directoryMessage, setDirectoryMessage] = useState("");
  const [directoryError, setDirectoryError] = useState("");
  const [newLibrary, setNewLibrary] = useState("");
  const [newLibraryDirectory, setNewLibraryDirectory] = useState("");
  const [librarySaving, setLibrarySaving] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState("");
  const [libraryError, setLibraryError] = useState("");
  const [listLibrary, setListLibrary] = useState("");
  const [functionQuery, setFunctionQuery] = useState("");
  const importInputRef = useRef(null);

  const selectedLibraryFunctions = useMemo(
    () => functions.filter((item) => item.library === listLibrary),
    [functions, listLibrary],
  );

  const visibleFunctions = useMemo(() => {
    const normalizedQuery = functionQuery.trim().toLocaleLowerCase();

    return selectedLibraryFunctions.filter(
      (item) =>
        !normalizedQuery ||
        String(item.name).toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [functionQuery, selectedLibraryFunctions]);

  const libraryDirectoryMap = useMemo(
    () =>
      new Map(
        directories.flatMap((directory) =>
          directory.libraries.map((name) => [name, directory.name]),
        ),
      ),
    [directories],
  );

  const loadCatalog = useCallback(async () => {
    setLibraryError("");
    setDirectoryError("");

    try {
      const [libraryData, directoryData] = await Promise.all([
        getLibraries(),
        getDirectories(),
      ]);
      setLibraries(libraryData);
      setDirectories(directoryData);
      setForm((current) => ({
        ...current,
        library:
          current.library && libraryData.includes(current.library)
            ? current.library
            : "",
      }));
      setNewLibraryDirectory((current) =>
        current && directoryData.some((item) => item.name === current)
          ? current
          : directoryData.find((item) => item.name !== "未分类")?.name ||
            directoryData[0]?.name ||
            "",
      );
    } catch (requestError) {
      setLibraryError(requestError.message);
      setDirectoryError(requestError.message);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    setListLibrary((current) =>
      current && libraries.includes(current) ? current : libraries[0] || "",
    );
  }, [libraries]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function changeListLibrary(event) {
    setListLibrary(event.target.value);
    setFunctionQuery("");
  }

  function resetForm() {
    setForm((current) => ({
      ...EMPTY_FORM,
      library: current.library,
    }));
    setEditingId(null);
  }

  function beginEdit(item) {
    setEditingId(item.id);
    setForm({
      library: item.library,
      name: item.name,
      description: item.description,
      parameters: item.parameters || "",
      code: item.code,
      result: item.result || "",
    });
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (editingId) {
        await updateFunction(editingId, form);
        setMessage("函数已经更新。");
      } else {
        await createFunction(form);
        setMessage("新函数已经添加。");
      }

      resetForm();
      await onRefresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(`确定删除“${item.name}”吗？`);
    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await deleteFunction(item.id);
      setMessage(`“${item.name}”已经删除。`);

      if (editingId === item.id) {
        resetForm();
      }

      await onRefresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleExport() {
    setTransferring(true);
    setTransferMessage("");
    setTransferError("");

    try {
      const blob = await exportFunctions();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = "functions.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setTransferMessage(`已经导出 ${functions.length} 个函数。`);
    } catch (requestError) {
      setTransferError(requestError.message);
    } finally {
      setTransferring(false);
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setTransferMessage("");
    setTransferError("");

    if (!file.name.toLowerCase().endsWith(".json")) {
      setTransferError("请选择 .json 文件。");
      return;
    }

    if (file.size > MAX_JSON_FILE_SIZE) {
      setTransferError("JSON 文件不能超过 50MB。");
      return;
    }

    setTransferring(true);

    try {
      const importedData = JSON.parse(await file.text());

      if (!Array.isArray(importedData)) {
        throw new Error("functions.json 的顶层数据必须是数组。");
      }

      const confirmed = window.confirm(
        importMode === "append"
          ? `将保留当前 ${functions.length} 个函数，并新增文件中的 ${importedData.length} 个函数，确定继续吗？`
          : `将用文件中的 ${importedData.length} 个函数覆盖当前 ${functions.length} 个函数，确定继续吗？`,
      );

      if (!confirmed) return;

      const result = await importFunctions(importedData, importMode);
      await onRefresh();
      await loadCatalog();
      setTransferMessage(result.message);
    } catch (importError) {
      setTransferError(
        importError instanceof SyntaxError
          ? "JSON 文件格式不正确，请检查逗号、引号和括号。"
          : importError.message,
      );
    } finally {
      setTransferring(false);
    }
  }

  async function handleCreateDirectory(event) {
    event.preventDefault();
    const name = newDirectory.trim();

    if (!name) return;

    setDirectorySaving(true);
    setDirectoryMessage("");
    setDirectoryError("");

    try {
      const created = await createDirectory(name);
      setNewDirectory("");
      await loadCatalog();
      setNewLibraryDirectory(created.name);
      setDirectoryMessage(`目录“${created.name}”已经新增。`);
      await onRefresh();
    } catch (requestError) {
      setDirectoryError(requestError.message);
    } finally {
      setDirectorySaving(false);
    }
  }

  async function handleDeleteDirectory(directory) {
    if (directory.name === "未分类") return;

    const confirmed = window.confirm(
      directory.libraries.length > 0
        ? `确定删除目录“${directory.name}”吗？其中的 ${directory.libraries.length} 个函数库会移到“未分类”，函数不会删除。`
        : `确定删除目录“${directory.name}”吗？`,
    );

    if (!confirmed) return;

    setDirectorySaving(true);
    setDirectoryMessage("");
    setDirectoryError("");

    try {
      await deleteDirectory(directory.name);
      await loadCatalog();
      await onRefresh();
      setDirectoryMessage(`目录“${directory.name}”已经删除。`);
    } catch (requestError) {
      setDirectoryError(requestError.message);
    } finally {
      setDirectorySaving(false);
    }
  }

  async function handleCreateLibrary(event) {
    event.preventDefault();
    const name = newLibrary.trim();

    if (!name) return;

    setLibrarySaving(true);
    setLibraryMessage("");
    setLibraryError("");

    try {
      const created = await createLibrary(name, newLibraryDirectory);
      setNewLibrary("");
      await loadCatalog();
      setLibraryMessage(
        `函数库“${created.name}”已经新增到“${created.directory}”目录。`,
      );
    } catch (requestError) {
      setLibraryError(requestError.message);
    } finally {
      setLibrarySaving(false);
    }
  }

  async function handleChangeLibraryDirectory(name, directory) {
    const previousDirectories = directories;

    setLibrarySaving(true);
    setLibraryMessage("");
    setLibraryError("");
    setDirectories((current) =>
      current.map((item) => ({
        ...item,
        libraries:
          item.name === directory
            ? [...item.libraries.filter((library) => library !== name), name]
            : item.libraries.filter((library) => library !== name),
      })),
    );

    try {
      const updated = await updateLibraryDirectory(name, directory);
      await loadCatalog();
      await onRefresh();
      setLibraryMessage(
        `函数库“${updated.name}”已经移动到“${updated.directory}”目录。`,
      );
    } catch (requestError) {
      setDirectories(previousDirectories);
      setLibraryError(requestError.message);
    } finally {
      setLibrarySaving(false);
    }
  }

  async function handleDeleteLibrary(name) {
    const functionCount = functions.filter((item) => item.library === name).length;

    if (functionCount > 0) {
      setLibraryMessage("");
      setLibraryError(
        `“${name}”中还有 ${functionCount} 个函数，请先修改或删除这些函数。`,
      );
      return;
    }

    const confirmed = window.confirm(`确定删除函数库“${name}”吗？`);

    if (!confirmed) return;

    setLibrarySaving(true);
    setLibraryMessage("");
    setLibraryError("");

    try {
      await deleteLibrary(name);
      await loadCatalog();
      setLibraryMessage(`函数库“${name}”已经删除。`);
    } catch (requestError) {
      setLibraryError(requestError.message);
    } finally {
      setLibrarySaving(false);
    }
  }

  async function handleMoveLibrary(name, direction) {
    const currentIndex = libraries.indexOf(name);
    const nextIndex = currentIndex + direction;

    if (
      librarySaving ||
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= libraries.length
    ) {
      return;
    }

    const previousLibraries = [...libraries];
    const nextLibraries = [...libraries];
    [nextLibraries[currentIndex], nextLibraries[nextIndex]] = [
      nextLibraries[nextIndex],
      nextLibraries[currentIndex],
    ];

    setLibraries(nextLibraries);
    setLibrarySaving(true);
    setLibraryMessage("");
    setLibraryError("");

    try {
      const savedLibraries = await updateLibraryOrder(nextLibraries);
      setLibraries(savedLibraries);
      await onRefresh();
      setLibraryMessage("函数库顺序已经保存。");
    } catch (requestError) {
      setLibraries(previousLibraries);
      setLibraryError(requestError.message);
    } finally {
      setLibrarySaving(false);
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">LOCAL CONTENT MANAGER</p>
          <h1>函数内容管理</h1>
          <p>这里的修改会直接写入服务器上的 functions.json。</p>
        </div>
        <div className="count-card">
          <strong>{functions.length}</strong>
          <span>个函数</span>
        </div>
      </div>

      <section className="library-manager-card directory-manager-card">
        <div className="library-manager-heading">
          <div>
            <span>DIRECTORIES</span>
            <h2>目录管理</h2>
            <p>目录用于归类函数库，例如 Python 目录可以包含 strings、list 和 tuple。</p>
          </div>

          <form className="library-create-form" onSubmit={handleCreateDirectory}>
            <input
              type="text"
              value={newDirectory}
              onChange={(event) => setNewDirectory(event.target.value)}
              placeholder="例如：Python"
              maxLength="50"
              aria-label="新目录名称"
            />
            <button
              type="submit"
              disabled={directorySaving || !newDirectory.trim()}
            >
              ＋ 新增目录
            </button>
          </form>
        </div>

        <div className="directory-chip-list">
          {directories.length === 0 ? (
            <p>还没有目录，请先新增一个。</p>
          ) : (
            directories.map((directory) => (
              <div className="directory-chip" key={directory.name}>
                <span>{directory.name}</span>
                <small>{directory.libraries.length} 个函数库</small>
                <button
                  type="button"
                  disabled={
                    directorySaving || directory.name === "未分类"
                  }
                  aria-label={`删除目录 ${directory.name}`}
                  title={
                    directory.name === "未分类"
                      ? "未分类目录用于接收没有归属的函数库，不能删除"
                      : "删除目录"
                  }
                  onClick={() => handleDeleteDirectory(directory)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {directoryMessage && (
          <p className="form-message success-message">{directoryMessage}</p>
        )}
        {directoryError && (
          <p className="form-message error-message">{directoryError}</p>
        )}
      </section>

      <section className="library-manager-card">
        <div className="library-manager-heading">
          <div>
            <span>FUNCTION LIBRARIES</span>
            <h2>函数库管理</h2>
            <p>可以新增、删除或调整函数库顺序，排序结果会保存在服务器上。</p>
          </div>

          <form
            className="library-create-form library-create-with-directory"
            onSubmit={handleCreateLibrary}
          >
            <select
              value={newLibraryDirectory}
              onChange={(event) => setNewLibraryDirectory(event.target.value)}
              disabled={librarySaving || directories.length === 0}
              aria-label="新函数库所属目录"
            >
              <option value="" disabled>
                选择目录
              </option>
              {directories.map((directory) => (
                <option value={directory.name} key={directory.name}>
                  {directory.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newLibrary}
              onChange={(event) => setNewLibrary(event.target.value)}
              placeholder="例如：Pandas"
              maxLength="50"
              aria-label="新函数库名称"
            />
            <button
              type="submit"
              disabled={
                librarySaving ||
                !newLibrary.trim() ||
                !newLibraryDirectory
              }
            >
              ＋ 新增函数库
            </button>
          </form>
        </div>

        <div className="library-chip-list">
          {libraries.length === 0 ? (
            <p>还没有函数库，请先新增一个。</p>
          ) : (
            libraries.map((name, libraryIndex) => {
              const functionCount = functions.filter(
                (item) => item.library === name,
              ).length;

              return (
                <div className="library-chip" key={name}>
                  <span>{name}</span>
                  <small>{functionCount} 个函数</small>
                  <select
                    className="library-directory-select"
                    value={libraryDirectoryMap.get(name) || "未分类"}
                    disabled={librarySaving || directories.length === 0}
                    aria-label={`选择函数库 ${name} 的所属目录`}
                    onChange={(event) =>
                      handleChangeLibraryDirectory(name, event.target.value)
                    }
                  >
                    {directories.map((directory) => (
                      <option value={directory.name} key={directory.name}>
                        {directory.name}
                      </option>
                    ))}
                  </select>
                  <div className="library-order-actions">
                    <button
                      type="button"
                      disabled={librarySaving || libraryIndex === 0}
                      aria-label={`上移函数库 ${name}`}
                      title="上移"
                      onClick={() => handleMoveLibrary(name, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={
                        librarySaving || libraryIndex === libraries.length - 1
                      }
                      aria-label={`下移函数库 ${name}`}
                      title="下移"
                      onClick={() => handleMoveLibrary(name, 1)}
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    className="library-delete-button"
                    type="button"
                    disabled={librarySaving}
                    aria-label={`删除函数库 ${name}`}
                    title={
                      functionCount > 0
                        ? "请先移动或删除这个函数库中的函数"
                        : "删除函数库"
                    }
                    onClick={() => handleDeleteLibrary(name)}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>

        {libraryMessage && (
          <p className="form-message success-message">{libraryMessage}</p>
        )}
        {libraryError && (
          <p className="form-message error-message">{libraryError}</p>
        )}
      </section>

      <section className="data-transfer-card">
        <div>
          <span>JSON BACKUP</span>
          <h2>数据导入与导出</h2>
          <p>导出用于备份；导入前可以选择新增或覆盖，文件最大 50MB。</p>
        </div>

        <div className="data-transfer-controls">
          <label className="import-mode-field">
            <span>导入方式</span>
            <select
              value={importMode}
              disabled={transferring}
              onChange={(event) => setImportMode(event.target.value)}
            >
              <option value="append">新增到现有数据</option>
              <option value="replace">覆盖现有数据</option>
            </select>
          </label>

          <div className="data-transfer-actions">
            <button type="button" disabled={transferring} onClick={handleExport}>
              ↓ 导出 functions.json
            </button>
            <button
              className="import-button"
              type="button"
              disabled={transferring}
              onClick={() => importInputRef.current?.click()}
            >
              ↑ 导入 functions.json
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={handleImport}
            />
          </div>
        </div>
      </section>

      {transferMessage && (
        <p className="form-message success-message transfer-message">
          {transferMessage}
        </p>
      )}
      {transferError && (
        <p className="form-message error-message transfer-message">{transferError}</p>
      )}

      <div className="admin-grid">
        <form className="editor-card" onSubmit={handleSubmit}>
          <div className="editor-title">
            <div>
              <span>{editingId ? "EDIT FUNCTION" : "NEW FUNCTION"}</span>
              <h2>{editingId ? "修改函数" : "添加函数"}</h2>
            </div>
            {editingId && (
              <button className="text-button" type="button" onClick={resetForm}>
                取消修改
              </button>
            )}
          </div>

          <div className="form-row">
            <label>
              函数库
              <select
                name="library"
                value={form.library}
                onChange={updateField}
                required
                disabled={libraries.length === 0}
              >
                <option value="" disabled>
                  {libraries.length === 0 ? "请先新增函数库" : "请选择函数库"}
                </option>
                {libraries.map((name) => (
                  <option value={name} key={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              函数名称 <span>*</span>
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="例如：Array.map()"
                required
              />
            </label>
          </div>

          <label>
            函数介绍 <span>*</span>
            <textarea
              name="description"
              value={form.description}
              onChange={updateField}
              placeholder="这个函数是用来做什么的？"
              rows="3"
              required
            />
          </label>

          <label>
            参数说明
            <textarea
              name="parameters"
              value={form.parameters}
              onChange={updateField}
              placeholder="参数名称、含义以及默认值"
              rows="3"
            />
          </label>

          <label>
            代码示例 <span>*</span>
            <textarea
              className="code-input"
              name="code"
              value={form.code}
              onChange={updateField}
              placeholder="输入示例代码"
              rows="7"
              required
              spellCheck="false"
            />
          </label>

          <label>
            运行结果
            <textarea
              className="code-input"
              name="result"
              value={form.result}
              onChange={updateField}
              placeholder="输入代码对应的结果"
              rows="4"
              spellCheck="false"
            />
          </label>

          {message && <p className="form-message success-message">{message}</p>}
          {error && <p className="form-message error-message">{error}</p>}

          <button
            className="primary-button full-button"
            type="submit"
            disabled={saving || libraries.length === 0}
          >
            {saving ? "正在保存……" : editingId ? "保存修改" : "添加函数"}
          </button>
        </form>

        <section className="function-list-card">
          <div className="list-heading">
            <div>
              <span>FUNCTION LIST</span>
              <h2>已有函数</h2>
            </div>
            <div className="function-list-tools">
              <label className="function-library-filter">
                <span aria-hidden="true">▦</span>
                <select
                  value={listLibrary}
                  onChange={changeListLibrary}
                  disabled={libraries.length === 0}
                  aria-label="选择要查看的函数库"
                >
                  <option value="" disabled>
                    选择函数库
                  </option>
                  {libraries.map((name) => (
                    <option value={name} key={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="function-list-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={functionQuery}
                  onChange={(event) => setFunctionQuery(event.target.value)}
                  placeholder="搜索函数名称"
                  aria-label="搜索函数名称"
                />
              </label>
              <button className="text-button" type="button" onClick={onRefresh}>
                ↻ 刷新
              </button>
            </div>
          </div>

          <div className="admin-function-list">
            {functions.length === 0 ? (
              <div className="empty-list">还没有函数，请先添加一个。</div>
            ) : !listLibrary ? (
              <div className="empty-list">请先选择要查看的函数库。</div>
            ) : selectedLibraryFunctions.length === 0 ? (
              <div className="empty-list">
                “{listLibrary}”中还没有函数。
              </div>
            ) : visibleFunctions.length === 0 ? (
              <div className="empty-list">
                “{listLibrary}”中没有找到名称包含“{functionQuery.trim()}”的函数。
              </div>
            ) : (
              <>
                <p className="function-list-summary">
                  {functionQuery.trim()
                    ? `在“${listLibrary}”中找到 ${visibleFunctions.length} 个函数`
                    : `“${listLibrary}”共有 ${visibleFunctions.length} 个函数`}
                </p>
                <section className="function-library-group">
                  <div className="function-library-heading">
                    <h3>{listLibrary}</h3>
                    <span>{visibleFunctions.length} 个函数</span>
                  </div>
                  <div className="function-library-items">
                    {visibleFunctions.map((item) => (
                      <article className="admin-function-item" key={item.id}>
                        <div className="item-index">
                          {String(item.id).padStart(2, "0")}
                        </div>
                        <div className="item-content">
                          <h3>{item.name}</h3>
                          <p>{item.description}</p>
                        </div>
                        <div className="item-actions">
                          <button type="button" onClick={() => beginEdit(item)}>
                            修改
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => handleDelete(item)}
                          >
                            删除
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default AdminView;
