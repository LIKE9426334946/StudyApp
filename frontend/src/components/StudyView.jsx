import { useEffect, useMemo, useState } from "react";

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

function StudyView({ functions, favorites, onToggleFavorite }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState("全部");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const libraries = useMemo(
    () => ["全部", ...new Set(functions.map((item) => item.library))],
    [functions],
  );

  const visibleFunctions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return functions.filter((item) => {
      const matchesLibrary = library === "全部" || item.library === library;
      const matchesFavorite = !favoritesOnly || favorites.has(item.id);
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery);

      return matchesLibrary && matchesFavorite && matchesQuery;
    });
  }, [favorites, favoritesOnly, functions, library, query]);

  useEffect(() => {
    setIndex(0);
    setExpanded(false);
  }, [library, query, favoritesOnly]);

  useEffect(() => {
    if (index >= visibleFunctions.length) {
      setIndex(Math.max(visibleFunctions.length - 1, 0));
    }
  }, [index, visibleFunctions.length]);

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

  function selectFunction(id) {
    const selectedIndex = visibleFunctions.findIndex((item) => item.id === id);

    if (selectedIndex >= 0) {
      setIndex(selectedIndex);
      setExpanded(false);
      setCatalogOpen(false);
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
              <strong>{current.name}</strong>
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
              // <div className="mobile-reveal-hint">
              //   点击上方按钮查看详情
              //   <span>👇</span>
              // </div>
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
              <div>
                <span>FUNCTION CATALOG</span>
                <h2>函数目录</h2>
              </div>
              <button type="button" onClick={() => setCatalogOpen(false)}>
                完成
              </button>
            </div>

            <label className="mobile-catalog-search">
              <span>⌕</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索函数名称"
                autoFocus
              />
            </label>

            <div className="mobile-catalog-tabs">
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

            <div className="mobile-catalog-list">
              {visibleFunctions.map((item, itemIndex) => (
                <button
                  className={current?.id === item.id ? "active" : ""}
                  type="button"
                  key={item.id}
                  onClick={() => selectFunction(item.id)}
                >
                  <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.library}</small>
                  </span>
                  <span>›</span>
                </button>
              ))}
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
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
