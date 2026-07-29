// Widget theme, stored in tenants.theme (jsonb) and baked into the embed
// snippet as a data-theme attribute — see docs/WIDGET_THEMING.md. Delivered
// via the snippet, not fetched at runtime, so it renders with zero flash.
export interface WidgetTheme {
  primaryColor?: string;
  textOnPrimary?: string;
  botBubbleColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  title?: string;
  position?: "bottom-right" | "bottom-left";
}

const THEME_FIELDS = [
  "primaryColor",
  "textOnPrimary",
  "botBubbleColor",
  "fontFamily",
  "logoUrl",
  "title",
  "position",
] as const;

/** Reads theme.* form fields into a WidgetTheme, dropping blanks so tenant defaults apply. */
export function themeFromFormData(formData: FormData): WidgetTheme {
  const theme: WidgetTheme = {};
  for (const field of THEME_FIELDS) {
    const value = String(formData.get(`theme.${field}`) ?? "").trim();
    if (value) (theme as Record<string, string>)[field] = value;
  }
  return theme;
}
