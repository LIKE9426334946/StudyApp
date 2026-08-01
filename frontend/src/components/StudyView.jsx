import { useEffect, useMemo, useState } from "react";
import {
  loadReviewedLibraries,
  saveReviewedLibraries,
} from "../storage";

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function StarIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        className={filled ? "filled" : ""}
        d="m12 2.8 2.84 5.75 6.35.92-4.6 4.48 1.09 6.33L12 17.3l-5.68 2.98 1.09-6.33-4.6-4.48 6.35-.92L12 2.8Z"
      />
    </svg>
  );
}

function ChevronIcon({ up = false }) {
  return (
    <svg className={up ? "up" : ""} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 9-3 3 3 3m8-6 3 3-3 3m-2-9-4 12" />
    </svg>
  );
}

function StudyView({
  functions,
  libraries: storedLibraries,
  directories: storedDirectories,
  favorites,
  onToggleFavorite,
  onRefresh,
  refreshing,
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [functionQuery, setFunctionQuery] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogDirectory, setCatalogDirectory] = useState("");
  const [catalogLibrary, setCatalogLibrary] = useState("");
  const [pendingCatalogFunctionId, setPendingCatalogFunctionId] = useState(null);
  const [library, setLibrary] = useState("全部");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [reviewedLibraries, setReviewedLibraries] = useState(() =>
    loadReviewedLibraries(),
  );

  const libraryNames = useMemo(
    () => [
      ...new Set([
        ...storedLibraries,
        ...functions.map((item) => item.library),
      ]),
    ],
    [functions, storedLibraries],
  );

  const libraries = useMemo(() => ["全部", ...libraryNames], [libraryNames]);

  const directories = useMemo(() => {
    const assignedLibraries = new Set();
    const normalized = (storedDirectories || []).map((directory) => {
      const directoryLibraries = (directory.libraries || []).filter((name) => {
        if (!libraryNames.includes(name) || assignedLibraries.has(name)) {
          return false;
        }

        assignedLibraries.add(name);
        return true;
      });

      return {
        name: directory.name,
        libraries: directoryLibraries,
      };
    });
    const unassigned = libraryNames.filter(
      (name) => !assignedLibraries.has(name),
    );

    if (unassigned.length > 0) {
      const uncategorized = normalized.find(
        (directory) => directory.name === "未分类",
      );

      if (uncategorized) {
        uncategorized.libraries.push(...unassigned);
      } else {
        normalized.push({ name: "未分类", libraries: unassigned });
      }
    }

    return normalized;
  }, [libraryNames, storedDirectories]);

  const visibleFunctions = useMemo(() => {
    const normalizedQuery = functionQuery.trim().toLowerCase();

    return functions.filter((item) => {
      const matchesLibrary = library === "全部" || item.library === library;
      const matchesFavorite = !favoritesOnly || favorites.has(item.id);
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery);

      return matchesLibrary && matchesFavorite && matchesQuery;
    });
  }, [favorites, favoritesOnly, functionQuery, functions, library]);

  const catalogDirectories = useMemo(() => {
    return directories.map((directory) => ({
      ...directory,
      functionCount: functions.filter((item) =>
        directory.libraries.includes(item.library),
      ).length,
    }));
  }, [directories, functions]);

  const libraryDirectoryMap = useMemo(
    () =>
      new Map(
        directories.flatMap((directory) =>
          directory.libraries.map((name) => [name, directory.name]),
        ),
      ),
    [directories],
  );

  const catalogLibraries = useMemo(() => {
    const selectedDirectory = directories.find(
      (directory) => directory.name === catalogDirectory,
    );

    return (selectedDirectory?.libraries || [])
      .map((name) => ({
        name,
        count: functions.filter((item) => item.library === name).length,
      }));
  }, [catalogDirectory, directories, functions]);

  const catalogSearchFunctions = useMemo(() => {
    const normalizedQuery = catalogQuery.trim().toLowerCase();

    if (!normalizedQuery) return [];

    return functions.filter((item) =>
      item.name.toLowerCase().includes(normalizedQuery),
    );
  }, [catalogQuery, functions]);

  const catalogFunctions = useMemo(
    () => functions.filter((item) => item.library === catalogLibrary),
    [catalogLibrary, functions],
  );

  useEffect(() => {
    setIndex(0);
    setExpanded(false);
  }, [favoritesOnly, functionQuery, library]);

  useEffect(() => {
    if (index >= visibleFunctions.length) {
      setIndex(Math.max(visibleFunctions.length - 1, 0));
    }
  }, [index, visibleFunctions.length]);

  useEffect(() => {
    if (pendingCatalogFunctionId === null) return;

    const selectedIndex = visibleFunctions.findIndex(
      (item) => item.id === pendingCatalogFunctionId,
    );

    if (selectedIndex >= 0) {
      setIndex(selectedIndex);
    }

    setPendingCatalogFunctionId(null);
  }, [pendingCatalogFunctionId, visibleFunctions]);

  const current = visibleFunctions[index];

  function move(direction, scrollToTop = false) {
    if (visibleFunctions.length < 2) return;

    setIndex((currentIndex) => {
      const next = currentIndex + direction;
      return (next + visibleFunctions.length) % visibleFunctions.length;
    });
    setExpanded(false);

    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function showCatalog() {
    setFavoritesOnly(false);
    setCatalogQuery("");
    setCatalogDirectory("");
    setCatalogLibrary("");
    setCatalogOpen(true);
  }

  function showFavorites() {
    setCatalogOpen(false);
    setFavoritesOnly(true);
  }

  function showStudy() {
    setCatalogOpen(false);
    setFavoritesOnly(false);
  }

  function selectCatalogFunction(id) {
    const selectedFunction = functions.find((item) => item.id === id);

    if (selectedFunction) {
      setPendingCatalogFunctionId(id);
      setLibrary(selectedFunction.library);
      setFunctionQuery("");
      setFavoritesOnly(false);
      setExpanded(false);
      setCatalogOpen(false);
    }
  }

  function toggleReviewedLibrary(libraryName) {
    setReviewedLibraries((current) => {
      const next = new Set(current);

      if (next.has(libraryName)) {
        next.delete(libraryName);
      } else {
        next.add(libraryName);
      }

      saveReviewedLibraries(next);
      return next;
    });
  }

  async function refreshCatalog() {
    setRefreshMessage("");
    setRefreshError("");

    try {
      await onRefresh();
      setRefreshMessage("已加载服务器上的最新函数内容。");
    } catch (requestError) {
      setRefreshError(requestError.message || "刷新失败，请稍后重试。");
    }
  }

  async function copyCode() {
    if (!current) return;

    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="study-layout">
      <div className={`mobile-study-view ${expanded ? "details-open" : ""}`}>
        {current ? (
          <>
            <header className="mobile-function-header">
              <button type="button" aria-label="打开函数目录" onClick={showCatalog}>
                <BackIcon />
              </button>
              <strong>{current.library}</strong>
              <button
                className={`mobile-star-button ${favorites.has(current.id) ? "active" : ""}`}
                type="button"
                aria-label={favorites.has(current.id) ? "取消收藏" : "添加收藏"}
                onClick={() => onToggleFavorite(current.id)}
              >
                <StarIcon filled={favorites.has(current.id)} />
              </button>
            </header>

            <article className="mobile-function-hero">
              <h1>{current.name}</h1>

              <button
                className="mobile-expand-button"
                type="button"
                aria-expanded={expanded}
                aria-controls="mobile-function-details"
                aria-label={expanded ? "隐藏函数详情" : "显示函数详情"}
                onClick={() => setExpanded((currentValue) => !currentValue)}
              >
                <ChevronIcon up={expanded} />
              </button>
            </article>

            <div className="mobile-function-actions">
              <span>
                {index + 1} / {visibleFunctions.length}
              </span>
              <button
                type="button"
                disabled={visibleFunctions.length < 2}
                onClick={() => move(1, true)}
              >
                下一个函数
                <span aria-hidden="true">→</span>
              </button>
            </div>

            {!expanded ? (
              <div className="mobile-reveal-hint">
                点击上方按钮查看详情
              </div>
            ) : (
              <div className="mobile-detail-content" id="mobile-function-details">
                <section className="mobile-detail-section">
                  <h2>
                    <span className="mobile-section-icon">▣</span>
                    函数解释
                  </h2>
                  <p>{current.description}</p>

                  <h3>语法</h3>
                  <div className="mobile-syntax-box">{current.name}</div>

                  <h3>参数</h3>
                  <p className="mobile-parameter-text">
                    {current.parameters || "这个函数暂时没有填写参数说明。"}
                  </p>
                </section>

                <section className="mobile-detail-section mobile-code-section">
                  <div className="mobile-section-heading">
                    <h2>
                      <span className="mobile-code-icon">&lt;/&gt;</span>
                      代码演示
                    </h2>
                    <button type="button" onClick={copyCode}>
                      {copied ? "已复制" : "▢ 复制"}
                    </button>
                  </div>

                  <pre className="mobile-code-block">
                    <code>{current.code}</code>
                  </pre>

                  <h3>运行结果</h3>
                  <pre className="mobile-result-box">{current.result || "暂无结果"}</pre>
                </section>
              </div>
            )}

            <nav className="mobile-bottom-nav" aria-label="手机端导航">
              <button type="button" onClick={showCatalog}>
                <ListIcon />
                <span>目录</span>
              </button>
              <button
                className={!favoritesOnly ? "active" : ""}
                type="button"
                onClick={showStudy}
              >
                <span className="mobile-study-nav-icon">
                  <CodeIcon />
                </span>
                <span>学习</span>
              </button>
              <button
                className={favoritesOnly ? "active" : ""}
                type="button"
                onClick={showFavorites}
              >
                <StarIcon filled={favoritesOnly} />
                <span>收藏</span>
              </button>
            </nav>
          </>
        ) : (
          <>
            <header className="mobile-function-header">
              <button type="button" aria-label="打开函数目录" onClick={showCatalog}>
                <BackIcon />
              </button>
              <strong>{favoritesOnly ? "我的收藏" : "函数学习"}</strong>
              <span className="mobile-header-placeholder" />
            </header>
            <div className="mobile-empty-state">
              <StarIcon />
              <h2>{favoritesOnly ? "还没有收藏" : "没有找到函数"}</h2>
              <p>
                {favoritesOnly
                  ? "看到不熟悉的函数时，点击右上角星标收藏。"
                  : "请换一个搜索关键词或分类。"}
              </p>
              <button type="button" onClick={showCatalog}>
                打开函数目录
              </button>
            </div>
            <nav className="mobile-bottom-nav" aria-label="手机端导航">
              <button type="button" onClick={showCatalog}>
                <ListIcon />
                <span>目录</span>
              </button>
              <button type="button" onClick={showStudy}>
                <span className="mobile-study-nav-icon">
                  <CodeIcon />
                </span>
                <span>学习</span>
              </button>
              <button
                className={favoritesOnly ? "active" : ""}
                type="button"
                onClick={showFavorites}
              >
                <StarIcon filled={favoritesOnly} />
                <span>收藏</span>
              </button>
            </nav>
          </>
        )}

        {catalogOpen && (
          <div className="mobile-catalog" role="dialog" aria-modal="true">
            <div className="mobile-catalog-header">
              {catalogLibrary ? (
                <div className="mobile-catalog-title-with-back">
                  <button
                    className="mobile-catalog-back"
                    type="button"
                    aria-label={`返回${catalogDirectory}目录`}
                    onClick={() => setCatalogLibrary("")}
                  >
                    <BackIcon />
                  </button>
                  <div>
                    <span>FUNCTION LIBRARY</span>
                    <h2>{catalogLibrary}</h2>
                  </div>
                </div>
              ) : catalogDirectory ? (
                <div className="mobile-catalog-title-with-back">
                  <button
                    className="mobile-catalog-back"
                    type="button"
                    aria-label="返回目录列表"
                    onClick={() => setCatalogDirectory("")}
                  >
                    <BackIcon />
                  </button>
                  <div>
                    <span>DIRECTORY</span>
                    <h2>{catalogDirectory}</h2>
                  </div>
                </div>
              ) : (
                <div>
                  <span>DIRECTORIES</span>
                  <h2>目录</h2>
                </div>
              )}
              <div className="mobile-catalog-header-actions">
                {!catalogDirectory && !catalogLibrary && (
                  <button
                    className="mobile-catalog-refresh"
                    type="button"
                    disabled={refreshing}
                    onClick={refreshCatalog}
                  >
                    <span
                      className={refreshing ? "refreshing" : ""}
                      aria-hidden="true"
                    >
                      ↻
                    </span>
                    {refreshing ? "刷新中" : "刷新"}
                  </button>
                )}
                <button type="button" onClick={() => setCatalogOpen(false)}>
                  完成
                </button>
              </div>
            </div>

            {!catalogDirectory &&
              !catalogLibrary &&
              (refreshMessage || refreshError) && (
                <p
                  className={`mobile-catalog-refresh-status ${
                    refreshError ? "error" : ""
                  }`}
                  role="status"
                >
                  {refreshError || refreshMessage}
                </p>
              )}

            {!catalogDirectory && !catalogLibrary && (
              <label className="mobile-catalog-search">
                <span>⌕</span>
                <input
                  type="search"
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  placeholder="搜索函数名称"
                />
              </label>
            )}

            <div className="mobile-catalog-list">
              {!catalogDirectory &&
                !catalogLibrary &&
                !catalogQuery.trim() &&
                catalogDirectories.map((item, itemIndex) => (
                  <button
                    className={
                      item.libraries.includes(current?.library) ? "active" : ""
                    }
                    type="button"
                    key={item.name}
                    onClick={() => setCatalogDirectory(item.name)}
                  >
                    <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.libraries.length} 个函数库 · {item.functionCount} 个函数
                      </small>
                    </span>
                    <span>›</span>
                  </button>
                ))}

              {!catalogDirectory &&
                !catalogLibrary &&
                !catalogQuery.trim() &&
                catalogDirectories.length === 0 && (
                <p className="mobile-catalog-empty">
                  还没有目录。
                </p>
              )}

              {!catalogDirectory &&
                !catalogLibrary &&
                catalogQuery.trim() &&
                catalogSearchFunctions.map((item, itemIndex) => (
                  <button
                    className={current?.id === item.id ? "active" : ""}
                    type="button"
                    key={item.id}
                    onClick={() => selectCatalogFunction(item.id)}
                  >
                    <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {libraryDirectoryMap.get(item.library) || "未分类"} ·{" "}
                        {item.library}
                      </small>
                    </span>
                    <span>›</span>
                  </button>
                ))}

              {!catalogDirectory &&
                !catalogLibrary &&
                catalogQuery.trim() &&
                catalogSearchFunctions.length === 0 && (
                  <p className="mobile-catalog-empty">
                    没有找到名称包含“{catalogQuery.trim()}”的函数。
                  </p>
                )}

              {catalogDirectory &&
                !catalogLibrary &&
                catalogLibraries.map((item, itemIndex) => (
                  <div
                    className={`mobile-catalog-library-row ${
                      current?.library === item.name ? "active" : ""
                    }`}
                    key={item.name}
                  >
                    <button
                      className={`mobile-library-review-button ${
                        reviewedLibraries.has(item.name) ? "reviewed" : ""
                      }`}
                      type="button"
                      aria-label={`${item.name}${
                        reviewedLibraries.has(item.name)
                          ? "已复习，点击取消标记"
                          : "未复习，点击标记为已复习"
                      }`}
                      aria-pressed={reviewedLibraries.has(item.name)}
                      onClick={() => toggleReviewedLibrary(item.name)}
                    >
                      {String(itemIndex + 1).padStart(2, "0")}
                    </button>
                    <button
                      className="mobile-catalog-library-open"
                      type="button"
                      onClick={() => setCatalogLibrary(item.name)}
                    >
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.count} 个函数</small>
                      </span>
                      <span>›</span>
                    </button>
                  </div>
                ))}

              {catalogDirectory &&
                !catalogLibrary &&
                catalogLibraries.length === 0 && (
                  <p className="mobile-catalog-empty">
                    这个目录中还没有函数库。
                  </p>
                )}

              {catalogLibrary &&
                catalogFunctions.map((item, itemIndex) => (
                  <button
                    className={current?.id === item.id ? "active" : ""}
                    type="button"
                    key={item.id}
                    onClick={() => selectCatalogFunction(item.id)}
                  >
                    <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.library}</small>
                    </span>
                    <span>›</span>
                  </button>
                ))}

              {catalogLibrary && catalogFunctions.length === 0 && (
                <p className="mobile-catalog-empty">
                  这个函数库中还没有函数。
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="desktop-study-view">
        <div className="study-heading">
          <div>
            <p className="eyebrow">FUNCTION LIBRARY</p>
            <h1>今天想学哪个函数？</h1>
            <p>先回忆它的作用，再展开查看解释和示例。</p>
          </div>

          <label className="search-box">
            <span>⌕</span>
            <input
              type="search"
              value={functionQuery}
              onChange={(event) => setFunctionQuery(event.target.value)}
              placeholder="搜索函数名称"
            />
          </label>
        </div>

        <div className="filter-row">
          <div className="library-tabs" aria-label="函数库筛选">
            {libraries.map((item) => (
              <button
                className={library === item ? "active" : ""}
                type="button"
                key={item}
                onClick={() => setLibrary(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            className={`favorite-filter ${favoritesOnly ? "active" : ""}`}
            type="button"
            onClick={() => setFavoritesOnly((currentValue) => !currentValue)}
          >
            {favoritesOnly ? "★" : "☆"} 只看收藏
          </button>
        </div>

        {!current ? (
          <div className="empty-state">
            <span>⌁</span>
            <h2>没有找到函数</h2>
            <p>换一个关键词或取消筛选试试。</p>
          </div>
        ) : (
          <>
            <article className={`study-card ${expanded ? "expanded" : ""}`}>
              <div className="card-topline">
                <span className="library-badge">{current.library}</span>
                <span className="progress-text">
                  {index + 1} / {visibleFunctions.length}
                </span>
              </div>

              <div className="function-title-row">
                <div>
                  <p className="function-label">函数名称</p>
                  <h2>{current.name}</h2>
                </div>

                <button
                  className={`favorite-button ${favorites.has(current.id) ? "active" : ""}`}
                  type="button"
                  aria-label={favorites.has(current.id) ? "取消收藏" : "添加收藏"}
                  onClick={() => onToggleFavorite(current.id)}
                >
                  {favorites.has(current.id) ? "★" : "☆"}
                </button>
              </div>

              {!expanded ? (
                <div className="memory-prompt">
                  <span className="memory-icon">?</span>
                  <div>
                    <strong>你还记得它是做什么的吗？</strong>
                    <p>先在心里想一想，然后查看答案。</p>
                  </div>
                </div>
              ) : (
                <div className="details">
                  <section>
                    <h3>
                      <span>01</span>
                      函数介绍
                    </h3>
                    <p>{current.description}</p>
                  </section>

                  <section>
                    <h3>
                      <span>02</span>
                      参数说明
                    </h3>
                    <p>{current.parameters || "这个函数暂时没有填写参数说明。"}</p>
                  </section>

                  <section>
                    <h3>
                      <span>03</span>
                      代码示例
                    </h3>
                    <pre className="code-block">
                      <code>{current.code}</code>
                    </pre>
                  </section>

                  <section>
                    <h3>
                      <span>04</span>
                      运行结果
                    </h3>
                    <pre className="result-block">{current.result || "暂无结果"}</pre>
                  </section>
                </div>
              )}

              <button
                className="reveal-button"
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((currentValue) => !currentValue)}
              >
                {expanded ? "收起解释" : "显示解释与代码"}
                <span>{expanded ? "↑" : "↓"}</span>
              </button>
            </article>

            <div className="card-navigation">
              <button type="button" onClick={() => move(-1)}>
                ← 上一个
              </button>
              <div className="progress-track" aria-hidden="true">
                <span
                  style={{
                    width: `${((index + 1) / visibleFunctions.length) * 100}%`,
                  }}
                />
              </div>
              <button type="button" onClick={() => move(1)}>
                下一个 →
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default StudyView;
