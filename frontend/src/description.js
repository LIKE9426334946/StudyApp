// Only paired single backticks and dollar signs have special meaning.
// The saved description stays plain text; this parser is used only for display.
export function parseDescription(value = "") {
  const source = String(value ?? "");
  const parts = [];
  let plain = "";
  let cursor = 0;
  const flush = () => {
    if (plain) parts.push({ type: "text", value: plain });
    plain = "";
  };

  while (cursor < source.length) {
    const marker = source[cursor];
    if (marker === "\\" && (source[cursor + 1] === "$" || source[cursor + 1] === "`")) {
      plain += source[cursor + 1];
      cursor += 2;
      continue;
    }
    if (marker !== "$" && marker !== "`") {
      plain += marker;
      cursor += 1;
      continue;
    }
    // Empty pairs / repeated markers remain literal, including $$ and ```.
    if (source[cursor + 1] === marker) {
      do { plain += source[cursor++]; } while (source[cursor] === marker);
      continue;
    }
    let closing = cursor + 1;
    while (closing < source.length) {
      if (source[closing] === "\\") { closing += 2; continue; }
      if (source[closing] === marker) break;
      closing += 1;
    }
    if (closing >= source.length) {
      plain += marker;
      cursor += 1;
      continue;
    }
    flush();
    parts.push({
      type: marker === "`" ? "bold" : "math",
      value: source.slice(cursor + 1, closing),
      source: source.slice(cursor, closing + 1),
    });
    cursor = closing + 1;
  }
  flush();
  return parts;
}
