"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { WidgetTheme } from "../../../../lib/widget-theme";

function buildSnippet(tenantKey: string, apiUrl: string, theme: WidgetTheme): string {
  const themeAttr = Object.keys(theme).length > 0 ? JSON.stringify(theme) : null;
  const lines = [
    `<script src="${apiUrl}/widget.js"`,
    `  data-tenant-key="${tenantKey}"`,
    `  data-api-url="${apiUrl}"`,
  ];
  if (themeAttr) lines.push(`  data-theme='${themeAttr}'`);
  return lines.join("\n") + ">\n</script>";
}

export function EmbedSnippet({
  tenantKey,
  apiUrl,
  theme,
}: {
  tenantKey: string;
  apiUrl: string;
  theme: WidgetTheme;
}) {
  const [copied, setCopied] = useState(false);
  const snippet = buildSnippet(tenantKey, apiUrl, theme);

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid gap-2">
      <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
        <code>{snippet}</code>
      </pre>
      <p className="text-xs text-muted-foreground">
        Paste this before <code>&lt;/body&gt;</code> on the university site. Re-copy it any time the
        theme changes below — the theme is baked into the snippet, not fetched at runtime, so it
        renders with no flash of default colors.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="w-fit">
        {copied ? "Copied" : "Copy snippet"}
      </Button>
    </div>
  );
}
