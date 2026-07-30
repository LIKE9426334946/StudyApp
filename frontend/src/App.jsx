import { useCallback, useEffect, useState } from "react";
import {
  getAdminSession,
  getDirectories,
  getFunctions,
  getLibraries,
  logoutAdmin,
} from "./api";
import AdminView from "./components/AdminView";
import AdminLogin from "./components/AdminLogin";
import StudyView from "./components/StudyView";
import {
  loadFavorites,
  loadStudyData,
  saveFavorites,
  saveStudyData,
} from "./storage";
import "./login.css";

async function fetchLatestData() {
  const [functions, libraries, directories] = await Promise.all([
    getFunctions(),
    getLibraries(),
    getDirectories(),
  ]);

  return { functions, libraries, directories };
}

function App() {
  const [mode, setMode] = useState("study");
  const [studyData, setStudyData] = useState(() => loadStudyData());
  const [studyRefreshing, setStudyRefreshing] = useState(false);
  const [studyError, setStudyError] = useState("");
  const [adminData, setAdminData] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [authLoading, setAuthLoading] = useState(true);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

  const refreshStudyData = useCallback(async () => {
    setStudyRefreshing(true);
    setStudyError("");

    try {
      const latestData = await fetchLatestData();
      setStudyData(latestData);
      saveStudyData(latestData);
      return latestData;
    } catch (requestError) {
      setStudyError(requestError.message);
      throw requestError;
    } finally {
      setStudyRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!studyData) {
      refreshStudyData().catch(() => {});
    }
  }, [refreshStudyData, studyData]);

  const loadAdminData = useCallback(async () => {
    setAdminLoading(true);
    setAdminError("");

    try {
      const latestData = await fetchLatestData();
      setAdminData(latestData);
      return latestData;
    } catch (requestError) {
      setAdminError(requestError.message);
      throw requestError;
    } finally {
      setAdminLoading(false);
    }
  }, []);

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

  function selectMode(nextMode) {
    setMode(nextMode);

    if (nextMode === "admin") {
      loadAdminData().catch(() => {});
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
        <button className="brand" type="button" onClick={() => selectMode("study")}>
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
            onClick={() => selectMode("study")}
          >
            学习
          </button>
          <button
            className={mode === "admin" ? "active" : ""}
            type="button"
            onClick={() => selectMode("admin")}
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
        {mode === "study" ? (
          !studyData ? (
            studyError ? (
              <section className="state-card error-card">
                <h2>暂时无法读取数据</h2>
                <p>{studyError}</p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => refreshStudyData().catch(() => {})}
                >
                  重新加载
                </button>
              </section>
            ) : (
              <section className="state-card">
                <span className="loading-dot" />
                正在初始化函数数据……
              </section>
            )
          ) : (
            <StudyView
              functions={studyData.functions}
              libraries={studyData.libraries}
              directories={studyData.directories}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onRefresh={refreshStudyData}
              refreshing={studyRefreshing}
            />
          )
        ) : authLoading ? (
          <section className="state-card">
            <span className="loading-dot" />
            正在确认登录状态……
          </section>
        ) : !adminAuthenticated ? (
          <AdminLogin
            onLogin={() => {
              setAdminAuthenticated(true);
              loadAdminData().catch(() => {});
            }}
          />
        ) : adminLoading && !adminData ? (
          <section className="state-card">
            <span className="loading-dot" />
            正在读取管理数据……
          </section>
        ) : adminError && !adminData ? (
          <section className="state-card error-card">
            <h2>暂时无法读取管理数据</h2>
            <p>{adminError}</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => loadAdminData().catch(() => {})}
            >
              重新加载
            </button>
          </section>
        ) : (
          <AdminView
            functions={adminData?.functions || []}
            onRefresh={loadAdminData}
          />
        )}
      </main>

      <footer className="site-footer">
        <span>函数数据保存在服务器 JSON 文件</span>
        <span>学习内容与收藏缓存在当前浏览器</span>
      </footer>
    </div>
  );
}

export default App;
