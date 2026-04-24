/**
 * renderMarkdown — minimal, safe markdown → HTML used for tenant-authored
 * policy pages. Supports H2/H3, paragraphs, bullet/numbered lists, bold,
 * italic, inline code, links, and horizontal rules. Escapes HTML in source
 * to prevent injection (tenants edit drafts directly).
 *
 * Why custom (not `marked` / `react-markdown`)?
 *   • Policies are short & predictable — a 30-line parser keeps the bundle slim
 *   • No remark plugins or sanitizers to wire up
 *   • Output is wrapped in `.policy-prose` for consistent styling
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string): string {
  // Order matters: code first so bold/italic inside backticks isn't transformed.
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-foreground/90 text-[0.92em]">$1</code>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) { closeLists(); i++; continue; }

    // Headings
    const h3 = /^###\s+(.*)$/.exec(line);
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) { closeLists(); out.push(`<h2>${inline(h2[1])}</h2>`); i++; continue; }
    if (h3) { closeLists(); out.push(`<h3>${inline(h3[1])}</h3>`); i++; continue; }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      closeLists();
      out.push("<hr />");
      i++; continue;
    }

    // Bullet list
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(ul[1])}</li>`);
      i++; continue;
    }

    // Numbered list
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(ol[1])}</li>`);
      i++; continue;
    }

    // Paragraph (collect consecutive non-empty, non-special lines)
    closeLists();
    const buf: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i].trimEnd();
      if (!next.trim()) break;
      if (/^(##\s|###\s|[-*]\s|\d+\.\s|-{3,}|_{3,}|\*{3,})/.test(next)) break;
      buf.push(next);
      i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  closeLists();
  return out.join("\n");
}