import dynamic from "next/dynamic";
import { useId, useLayoutEffect, useRef, useState } from "react";
import {
  Bold,
  Eye,
  Heading,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Table2,
} from "lucide-react";

const MarkdownDescription = dynamic(() => import("./markdown-description"), {
  loading: () => <p className="muted">Loading formatted text…</p>,
});

const formats = [
  { label: "Heading", icon: Heading, prefix: "### ", line: true },
  { label: "Bold", icon: Bold, prefix: "**", suffix: "**" },
  { label: "Italic", icon: Italic, prefix: "_", suffix: "_" },
  { label: "Strikethrough", icon: Strikethrough, prefix: "~~", suffix: "~~" },
  { label: "Bulleted list", icon: List, prefix: "- ", line: true },
  { label: "Numbered list", icon: ListOrdered, prefix: "1. ", line: true },
  { label: "Quote", icon: Quote, prefix: "> ", line: true },
  { label: "Link", icon: Link2, prefix: "[", suffix: "](https://example.com)" },
  {
    label: "Table",
    icon: Table2,
    prefix: "| Feature | Details |\n| --- | --- |\n| ",
    suffix: " | Value |",
    block: true,
  },
];

export function Description({ text }) {
  return <MarkdownDescription text={text} />;
}

export function DescriptionField({
  label,
  value,
  onChange,
  maxLength,
  ...props
}) {
  const id = useId();
  const input = useRef(null);
  const nextSelection = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  useLayoutEffect(() => {
    if (nextSelection.current) {
      input.current.setSelectionRange(...nextSelection.current);
      nextSelection.current = null;
    }
  }, [value]);

  function applyFormat({ label, prefix, suffix = "", line, block }) {
    let { selectionStart: start, selectionEnd: end } = input.current;

    if (line) {
      start = value.slice(0, start).lastIndexOf("\n") + 1;
      const lastLine = end > start && value[end - 1] === "\n" ? end - 1 : end;
      const lineEnd = value.indexOf("\n", lastLine);
      end = lineEnd === -1 ? value.length : lineEnd;
    }

    if (!line && !block) {
      const selection = value.slice(start, end);
      if (selection.trim()) {
        start += selection.length - selection.trimStart().length;
        end -= selection.length - selection.trimEnd().length;
      }
    }

    const selected = value.slice(start, end);
    const content =
      (block
        ? selected.replaceAll("\n", " ").replaceAll("|", "\\|")
        : selected) || (line || block ? label : "text");
    const marked = line ? content.split("\n").join("\n" + prefix) : content;
    const leading = block && start > 0 ? "\n\n" : "";
    const trailing = block && end < value.length ? "\n\n" : "";
    const replacement = leading + prefix + marked + suffix + trailing;
    const next = value.slice(0, start) + replacement + value.slice(end);

    input.current.focus();
    if (next.length > maxLength) {
      setLimitReached(true);
      return;
    }

    const textStart = start + leading.length + prefix.length;
    const textEnd = textStart + marked.length;
    nextSelection.current =
      label === "Link" && selected
        ? [textEnd + 2, textEnd + suffix.length - 1]
        : [textStart, textEnd];
    setLimitReached(false);
    onChange(next);
  }

  return (
    <div className="field description-field">
      <label htmlFor={id}>{label}</label>
      <div className="description-editor">
        <div
          className="description-toolbar"
          role="group"
          aria-label="Text formatting"
        >
          {formats.map(({ icon: Icon, ...format }) => (
            <button
              key={format.label}
              type="button"
              title={format.label}
              aria-label={format.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyFormat(format)}
            >
              <Icon size={17} aria-hidden="true" />
            </button>
          ))}
          <button
            className="description-preview-toggle"
            type="button"
            aria-pressed={showPreview}
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye size={17} aria-hidden="true" />
            Preview
          </button>
        </div>
        <textarea
          {...props}
          id={id}
          ref={input}
          maxLength={maxLength}
          value={value}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            setLimitReached(false);
            onChange(event.target.value);
          }}
        />
      </div>
      <div className="description-meta">
        <span id={`${id}-hint`}>Markdown supported</span>
        <span>
          {value.length} / {maxLength}
        </span>
      </div>
      {limitReached && (
        <p className="description-limit" role="status">
          Shorten the description to add this formatting.
        </p>
      )}
      {showPreview && (
        <div
          className="description-preview"
          aria-label="Description preview"
          role="region"
        >
          {value.trim() ? (
            <Description text={value.trim()} />
          ) : (
            <p className="muted">Your preview will appear here.</p>
          )}
        </div>
      )}
    </div>
  );
}
