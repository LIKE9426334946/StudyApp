import { memo, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { parseDescription } from "../description";

function FunctionDescription({ text }) {
  const content = useMemo(() => parseDescription(text).map((part, index) => {
    if (part.type === "text") return part.value;
    if (part.type === "bold") return <strong key={index}>{part.value}</strong>;
    try {
      // Only KaTeX-generated markup enters HTML; raw text is always escaped by React.
      const html = katex.renderToString(part.value, {
        displayMode: false,
        output: "htmlAndMathml",
        throwOnError: true,
        trust: false,
        strict: "ignore",
        maxExpand: 1000,
        maxSize: 20,
      });
      return <span className="description-math" key={index} dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <span className="description-math-error" key={index} title="公式格式有误，暂时显示原文">{part.source}</span>;
    }
  }), [text]);

  return <div className="function-description">{content}</div>;
}

export default memo(FunctionDescription);
