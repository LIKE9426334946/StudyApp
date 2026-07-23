import { useEffect, useMemo, useState } from "react";

function StudyView({ functions, favorites, onToggleFavorite }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState("全部");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

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

  function move(direction) {
    if (visibleFunctions.length < 2) return;

    setIndex((currentIndex) => {
      const next = currentIndex + direction;
      return (next + visibleFunctions.length) % visibleFunctions.length;
    });
    setExpanded(false);
  }

  return (
    <section className="study-layout">
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
    </section>
  );
}

export default StudyView;

