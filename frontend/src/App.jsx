import { useCallback, useEffect, useState } from "react";
import {
  getAdminSession,
  getFunctions,
  logoutAdmin,
} from "./api";
import AdminView from "./components/AdminView";
import AdminLogin from "./components/AdminLogin";
import StudyView from "./components/StudyView";
import { loadFavorites, saveFavorites } from "./storage";
import "./login.css";

function App() {
  const [mode, setMode] = useState("study");
  const [functions, setFunctions] = useState([]);
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

  const loadData = useCallback(async () => {
    setError("");

    try {
      const data = await getFunctions();
      setFunctions(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let active = true;

    getAdminSession()
      .then(() => {
        if (active) setAdminAuthenticated(true);
      })
      .catch(() => {
        if (active) setAdminAuthenticated(false);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    const handleUnauthorized = () => {
      setAdminAuthenticated(false);
      setAuthLoading(false);
    };

    window.addEventListener("studyapp:unauthorized", handleUnauthorized);

    return () => {
      active = false;
      window.removeEventListener("studyapp:unauthorized", handleUnauthorized);
    };
  }, []);

  async function handleLogout() {
    try {
      await logoutAdmin();
    } finally {
      setAdminAuthenticated(false);
    }
  }

  function toggleFavorite(id) {
    setFavorites((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      saveFavorites(next);
      return next;
    });
  }

  return (
    <div className={`app-shell mode-${mode}`}>
      <header className="site-header">
        <button className="brand" type="button" onClick={() => setMode("study")}>
          <span className="brand-mark">S</span>
          <span>
            <strong>StudyApp</strong>
            <small>每天认识一个函数</small>
          </span>
        </button>

        <nav className="mode-switch" aria-label="页面模式">
          <button
            className={mode === "study" ? "active" : ""}
            type="button"
            onClick={() => setMode("study")}
          >
            学习
          </button>
          <button
            className={mode === "admin" ? "active" : ""}
            type="button"
            onClick={() => setMode("admin")}
          >
            管理
          </button>
          {mode === "admin" && adminAuthenticated && (
            <button type="button" onClick={handleLogout}>
              退出
            </button>
          )}
        </nav>
      </header>

      <main className="page-content">
        {loading ? (
          <section className="state-card">
            <span className="loading-dot" />
            正在读取函数数据……
          </section>
        ) : error ? (
          <section className="state-card error-card">
            <h2>暂时无法读取数据</h2>
            <p>{error}</p>
            <button className="primary-button" type="button" onClick={loadData}>
              重新加载
            </button>
          </section>
        ) : mode === "study" ? (
          <StudyView
            functions={functions}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
        ) : authLoading ? (
          <section className="state-card">
            <span className="loading-dot" />
            正在确认登录状态……
          </section>
        ) : !adminAuthenticated ? (
          <AdminLogin onLogin={() => setAdminAuthenticated(true)} />
        ) : (
          <AdminView functions={functions} onRefresh={loadData} />
        )}
      </main>

      <footer className="site-footer">
        <span>数据保存在本地 JSON 文件</span>
        <span>收藏保存在当前浏览器</span>
      </footer>
    </div>
  );
}

export default App;
