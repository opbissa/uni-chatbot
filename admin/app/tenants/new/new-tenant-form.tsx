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
import { createTenant } from "./actions";

export function NewTenantForm() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    const result = await createTenant(formData);
    setSubmitting(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="Maharaja Ganga Singh University" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="tenantKey">Tenant key</Label>
        <Input id="tenantKey" name="tenantKey" required placeholder="mgsu" pattern="[a-z0-9-]+" />
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, hyphens. Given to the widget embed snippet.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="domains">Allowed domains</Label>
        <Input id="domains" name="domains" placeholder="mgsubikaner.ac.in, www.mgsubikaner.ac.in" />
        <p className="text-xs text-muted-foreground">
          Comma-separated. The widget's Origin is checked against these.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="llmProvider">LLM provider</Label>
        <Select name="llmProvider" defaultValue="ollama">
          <SelectTrigger id="llmProvider" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ollama">Ollama (self-hosted Qwen)</SelectItem>
            <SelectItem value="claude">Claude (Haiku)</SelectItem>
            <SelectItem value="gemini">Gemini (2.5 Flash)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="defaultLanguage">Default language</Label>
        <Input id="defaultLanguage" name="defaultLanguage" defaultValue="en" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Creating..." : "Create tenant"}
      </Button>
    </form>
  );
}
