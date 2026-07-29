"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WidgetTheme } from "../../../../lib/widget-theme";
import { updateTenantTheme } from "./actions";

export function WidgetThemeForm({
  tenantId,
  theme,
  onSaved,
}: {
  tenantId: string;
  theme: WidgetTheme;
  onSaved: (theme: WidgetTheme) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    const result = await updateTenantTheme(tenantId, formData);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
    } else if (result?.theme) {
      onSaved(result.theme);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="theme.primaryColor">Primary color</Label>
          <Input
            id="theme.primaryColor"
            name="theme.primaryColor"
            type="color"
            defaultValue={theme.primaryColor || "#1a56db"}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="theme.textOnPrimary">Text on primary</Label>
          <Input
            id="theme.textOnPrimary"
            name="theme.textOnPrimary"
            type="color"
            defaultValue={theme.textOnPrimary || "#ffffff"}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="theme.botBubbleColor">Bot bubble color</Label>
        <Input
          id="theme.botBubbleColor"
          name="theme.botBubbleColor"
          type="color"
          defaultValue={theme.botBubbleColor || "#f1f3f5"}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="theme.title">Header title</Label>
        <Input
          id="theme.title"
          name="theme.title"
          placeholder="Ask us anything"
          defaultValue={theme.title}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="theme.logoUrl">Logo URL</Label>
        <Input
          id="theme.logoUrl"
          name="theme.logoUrl"
          placeholder="https://university.edu/logo.png"
          defaultValue={theme.logoUrl}
        />
        <p className="text-xs text-muted-foreground">Optional. Shown next to the header title.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="theme.fontFamily">Font family</Label>
        <Input
          id="theme.fontFamily"
          name="theme.fontFamily"
          placeholder="system-ui, sans-serif"
          defaultValue={theme.fontFamily}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="theme.position">Launcher position</Label>
        <Select name="theme.position" defaultValue={theme.position || "bottom-right"}>
          <SelectTrigger id="theme.position" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bottom-right">Bottom right</SelectItem>
            <SelectItem value="bottom-left">Bottom left</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Saving..." : "Save widget theme"}
      </Button>
    </form>
  );
}
