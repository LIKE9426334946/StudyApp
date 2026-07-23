import { useRef, useState } from "react";
import {
  createFunction,
  deleteFunction,
  exportFunctions,
  importFunctions,
  updateFunction,
} from "../api";

const EMPTY_FORM = {
  library: "JavaScript",
  name: "",
  description: "",
  parameters: "",
  code: "",
  result: "",
};

function AdminView({ functions, onRefresh }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const [transferError, setTransferError] = useState("");
  const importInputRef = useRef(null);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    if (file.size > 1024 * 1024) {
      setTransferError("JSON 文件不能超过 1MB。");
      return;
    }

    setTransferring(true);

    try {
      const importedData = JSON.parse(await file.text());

      if (!Array.isArray(importedData)) {
        throw new Error("functions.json 的顶层数据必须是数组。");
      }

      const confirmed = window.confirm(
        `导入后会用文件中的 ${importedData.length} 个函数替换当前 ${functions.length} 个函数，确定继续吗？`,
      );

      if (!confirmed) return;

      const result = await importFunctions(importedData);
      resetForm();
      await onRefresh();
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

      <section className="data-transfer-card">
        <div>
          <span>JSON BACKUP</span>
          <h2>数据导入与导出</h2>
          <p>导出用于备份；导入会替换服务器上当前的全部函数。</p>
        </div>

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
              <input
                name="library"
                value={form.library}
                onChange={updateField}
                placeholder="例如：Python"
              />
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

          <button className="primary-button full-button" type="submit" disabled={saving}>
            {saving ? "正在保存……" : editingId ? "保存修改" : "添加函数"}
          </button>
        </form>

        <section className="function-list-card">
          <div className="list-heading">
            <div>
              <span>FUNCTION LIST</span>
              <h2>已有函数</h2>
            </div>
            <button className="text-button" type="button" onClick={onRefresh}>
              ↻ 刷新
            </button>
          </div>

          <div className="admin-function-list">
            {functions.length === 0 ? (
              <div className="empty-list">还没有函数，请先添加一个。</div>
            ) : (
              functions.map((item) => (
                <article className="admin-function-item" key={item.id}>
                  <div className="item-index">
                    {String(item.id).padStart(2, "0")}
                  </div>
                  <div className="item-content">
                    <span>{item.library}</span>
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
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default AdminView;
