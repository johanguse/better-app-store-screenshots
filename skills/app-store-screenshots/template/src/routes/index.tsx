import { createFileRoute } from "@tanstack/react-router";
import { ScreenshotEditor } from "@/components/editor/screenshot-editor";

export const Route = createFileRoute("/")({
  component: ScreenshotEditor,
});
