"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/cn";

interface Props {
  text: string;
  className?: string;
}

export function Markdown({ text, className }: Props) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-invert max-w-none",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-h4:text-sm",
        "prose-p:leading-relaxed prose-p:my-2",
        "prose-strong:text-white prose-strong:font-semibold",
        "prose-em:text-neutral-200",
        "prose-code:text-indigo-200 prose-code:bg-indigo-500/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg prose-pre:my-3",
        "prose-a:text-indigo-300 prose-a:no-underline hover:prose-a:underline",
        "prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:marker:text-neutral-500",
        "prose-hr:border-white/10",
        "prose-blockquote:border-l-indigo-500/40 prose-blockquote:text-neutral-300",
        "prose-table:text-sm",
        "prose-th:text-neutral-400 prose-th:border-white/10",
        "prose-td:border-white/5",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
