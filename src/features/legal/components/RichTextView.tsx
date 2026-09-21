import { Link } from "react-router-dom";

import type { Inline, RichText } from "../types";

const LINK_CLASS =
  "text-primary decoration-primary/40 hover:decoration-primary font-medium underline underline-offset-4 transition-colors";

function InlineView({ run }: { run: Inline }) {
  if (typeof run === "string") return run;

  if ("strong" in run) {
    return <strong className="text-foreground font-semibold">{run.strong}</strong>;
  }

  // Routes of this site stay inside the SPA; everything else is a plain anchor.
  if (run.href.startsWith("/")) {
    return (
      <Link to={run.href} className={LINK_CLASS}>
        {run.label}
      </Link>
    );
  }

  const external = run.href.startsWith("http");
  return (
    <a
      href={run.href}
      className={LINK_CLASS}
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {run.label}
    </a>
  );
}

export function RichTextView({ text }: { text: RichText }) {
  if (typeof text === "string") return text;

  return text.map((run, index) => <InlineView key={index} run={run} />);
}
