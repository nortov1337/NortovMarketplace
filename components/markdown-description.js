import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm, remarkBreaks];

function Heading({ children }) {
  return <h4>{children}</h4>;
}

const elements = {
  h1: Heading,
  h2: Heading,
  h3: Heading,
  img: ({ alt }) => alt,
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      children
    ),
  table: ({ children }) => (
    <div
      className="description-table"
      role="region"
      tabIndex={0}
      aria-label="Table"
    >
      <table>{children}</table>
    </div>
  ),
};

export default function MarkdownDescription({ text }) {
  return (
    <div className="description-text">
      <Markdown
        components={elements}
        remarkPlugins={plugins}
        urlTransform={(url) => (/^https?:\/\//i.test(url) ? url : "")}
      >
        {text}
      </Markdown>
    </div>
  );
}
