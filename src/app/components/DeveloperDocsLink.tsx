import { ArrowUpRight, BookOpen } from "lucide-react";
import "./developer-docs-link.css";

/** Ordinary navigation leaves the current workspace and its drafts mounted. */
export function DeveloperDocsLink({
  navigation = false,
}: {
  navigation?: boolean;
}) {
  return (
    <a
      href="/docs/"
      target="_blank"
      rel="noopener noreferrer"
      className={`developer-docs-link${navigation ? " developer-docs-link--navigation" : ""}`}
    >
      <BookOpen size={14} aria-hidden="true" />
      <span>
        Developer docs<small>Opens in a new tab</small>
      </span>
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}
