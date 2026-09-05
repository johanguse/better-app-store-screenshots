import { DEVICE_LABEL, themeById } from "./constants";
import type { Device, LocalizedText, ProjectState, Slide, Theme } from "./types";

export type PreflightSeverity = "error" | "warning";

export type PreflightIssue = {
  id: string;
  severity: PreflightSeverity;
  code: string;
  title: string;
  detail: string;
  device?: Device;
  slideId?: string;
  locale?: string;
};

export type PreflightReport = {
  issues: PreflightIssue[];
  errors: number;
  warnings: number;
  passed: boolean;
};

// Apple/Google cap bulk-uploaded screenshots per device; iPhone/iPad allow more.
function slideLimit(device: Device): number {
  return device === "iphone" || device === "ipad" ? 10 : 8;
}

function requiresScreenshot(device: Device, slide: Slide): boolean {
  return device !== "feature-graphic" && slide.layout !== "feature-graphic" && slide.layout !== "no-device";
}

function localizedValue(field: LocalizedText | undefined, locale: string): string {
  return field?.[locale]?.trim() ?? "";
}

function luminance(hex: string): number | null {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(foreground: string, background: string): number | null {
  const fg = luminance(foreground);
  const bg = luminance(background);
  if (fg == null || bg == null) return null;
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

function checkTheme(theme: Theme, issues: PreflightIssue[]): void {
  const pairs: Array<[string, string, string]> = [
    [theme.fg, theme.bg, "default"],
    [theme.fgAlt, theme.bgAlt, "inverted"],
  ];
  for (const [foreground, background, mode] of pairs) {
    const ratio = contrastRatio(foreground, background);
    if (ratio != null && ratio < 4.5) {
      issues.push({
        id: `theme-contrast-${mode}`,
        severity: "warning",
        code: "theme-contrast",
        title: "Theme contrast is low",
        detail: `${theme.name} ${mode} text contrast is ${ratio.toFixed(2)}:1; aim for at least 4.5:1.`,
      });
    }
  }
}

export function runPreflight(state: ProjectState): PreflightReport {
  const issues: PreflightIssue[] = [];

  checkTheme(themeById(state.themeId), issues);

  for (const device of Object.keys(DEVICE_LABEL) as Device[]) {
    const slides = state.slidesByDevice[device] ?? [];
    if (slides.length === 0) {
      issues.push({
        id: `${device}-empty`,
        severity: "error",
        code: "empty-deck",
        title: "Device deck is empty",
        detail: `${DEVICE_LABEL[device]} has no screens to export.`,
        device,
      });
      continue;
    }

    const limit = slideLimit(device);
    if (slides.length > limit) {
      issues.push({
        id: `${device}-limit`,
        severity: "error",
        code: "slide-limit",
        title: "Store screenshot limit exceeded",
        detail: `${slides.length} screens exceed the ${limit}-screen limit for ${DEVICE_LABEL[device]}.`,
        device,
      });
    }

    const seenIds = new Set<string>();
    slides.forEach((slide, index) => {
      if (seenIds.has(slide.id)) {
        issues.push({
          id: `${device}-${slide.id}-${index}-duplicate`,
          severity: "error",
          code: "duplicate-id",
          title: "Duplicate slide ID",
          detail: `Screen ${index + 1} of ${DEVICE_LABEL[device]} reuses ID "${slide.id}".`,
          device,
          slideId: slide.id,
        });
      }
      seenIds.add(slide.id);

      if (requiresScreenshot(device, slide) && !slide.screenshot) {
        issues.push({
          id: `${device}-${slide.id}-screenshot`,
          severity: "warning",
          code: "missing-screenshot",
          title: "Screenshot is missing",
          detail: `Screen ${index + 1} of ${DEVICE_LABEL[device]} will export with an empty device.`,
          device,
          slideId: slide.id,
        });
      }

      if (slide.layout === "two-devices" && slide.screenshot && !slide.screenshotSecondary) {
        issues.push({
          id: `${device}-${slide.id}-secondary`,
          severity: "warning",
          code: "missing-secondary-screenshot",
          title: "Secondary screenshot is missing",
          detail: `Screen ${index + 1} of ${DEVICE_LABEL[device]} will reuse the primary screenshot for the back device.`,
          device,
          slideId: slide.id,
        });
      }

      for (const locale of state.locales) {
        if (!localizedValue(slide.headline, locale)) {
          issues.push({
            id: `${device}-${slide.id}-${locale}-headline`,
            severity: "warning",
            code: "missing-copy",
            title: "Localized headline is missing",
            detail: `Screen ${index + 1} of ${DEVICE_LABEL[device]} has no "${locale}" headline; it will fall back to another locale.`,
            device,
            slideId: slide.id,
            locale,
          });
        }
      }

      for (const textElement of slide.textElements ?? []) {
        for (const locale of state.locales) {
          if (!localizedValue(textElement.text, locale)) {
            issues.push({
              id: `${device}-${slide.id}-${textElement.id}-${locale}`,
              severity: "warning",
              code: "missing-element-copy",
              title: "Text element translation is missing",
              detail: `A text element on screen ${index + 1} of ${DEVICE_LABEL[device]} has no "${locale}" text.`,
              device,
              slideId: slide.id,
              locale,
            });
          }
        }
      }
    });
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return { issues, errors, warnings, passed: errors === 0 };
}
