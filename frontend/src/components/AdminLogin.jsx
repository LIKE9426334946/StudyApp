import { useState } from "react";
import { loginAdmin } from "../api";

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await loginAdmin(username, password);
      onLogin();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-mark" aria-hidden="true">
          S
        </div>
        <p className="eyebrow">PRIVATE CONTENT MANAGER</p>
        <h1>登录管理界面</h1>
        <p className="admin-login-description">
          请输入管理账号。登录成功后，本浏览器可保持登录 30 天。
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            用户名
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="form-message error-message">{error}</p>}

          <button
            className="primary-button"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "正在登录……" : "登录"}
          </button>
        </form>

        <small>仅支持固定管理账号，不提供注册或创建账号功能。</small>
      </div>
    </section>
  );
}

export default AdminLogin;
