import { useRef, useState } from "react";
import { exportBackup, restoreBackup } from "../api";

export default function BackupPanel({ onRestored, disabled = false }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const blob = await exportBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `StudyApp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("已发起下载，请在浏览器下载列表中查看。");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function restore(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    setError("");
    setBusy(true);
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error("备份文件不能超过 50MB。");
      const backup = JSON.parse(await file.text());
      if (backup?.format !== "StudyApp-backup" || backup.version !== 1 || !Array.isArray(backup.functions) || !Array.isArray(backup.libraries) || !Array.isArray(backup.directories)) {
        throw new Error("请选择 StudyApp 完整备份；普通函数 JSON 请使用下方的函数导入。");
      }
      if (!window.confirm(`将恢复 ${backup.functions.length} 个函数、${backup.libraries.length} 个函数库和 ${backup.directories.length} 个目录，并覆盖当前内容。需要保留当前内容时，请先下载完整备份到电脑。确定恢复吗？`)) return;
      const result = await restoreBackup(backup);
      try {
        await onRestored();
        setMessage(`${result.message} 手机端请在目录首页点击刷新。`);
      } catch {
        setMessage(`${result.message} 管理列表刷新失败，请重新打开管理页面。`);
      }
    } catch (requestError) {
      setError(requestError instanceof SyntaxError ? "备份文件不是有效的 JSON。" : requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="library-manager-card">
      <div className="library-manager-heading">
        <div>
          <h2>完整备份与恢复</h2>
          <p>保存全部函数、目录、空函数库和排序。收藏与复习标记保存在当前浏览器。</p>
          <p>备份文件下载到当前设备，服务器不保留备份副本。</p>
        </div>
      </div>
      <div className="backup-actions">
        <button className="primary-button" type="button" disabled={disabled || busy} onClick={() => download()}>下载完整备份</button>
        <button className="secondary-button" type="button" disabled={disabled || busy} onClick={() => input.current?.click()}>恢复完整备份</button>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={restore} />
      </div>
      {busy && <p role="status">正在处理，请稍候……</p>}
      {message && <p className="form-message success-message" role="status">{message}</p>}
      {error && <p className="form-message error-message" role="alert">{error}</p>}
    </section>
  );
}
