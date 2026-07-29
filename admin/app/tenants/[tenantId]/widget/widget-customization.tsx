"use client";

import { useState } from "react";
import type { WidgetTheme } from "../../../../lib/widget-theme";
import { WidgetThemeForm } from "./widget-theme-form";
import { EmbedSnippet } from "./embed-snippet";

export function WidgetCustomization({
  tenantId,
  tenantKey,
  apiUrl,
  initialTheme,
}: {
  tenantId: string;
  tenantKey: string;
  apiUrl: string;
  initialTheme: WidgetTheme;
}) {
  const [theme, setTheme] = useState(initialTheme);

  return (
    <div className="grid gap-6">
      <WidgetThemeForm tenantId={tenantId} theme={theme} onSaved={setTheme} />
      <div className="grid gap-2">
        <h2 className="text-sm font-medium">Embed snippet</h2>
        <EmbedSnippet tenantKey={tenantKey} apiUrl={apiUrl} theme={theme} />
      </div>
    </div>
  );
}
