/**
 * EXTENSION POINT (Phase 5: Story export).
 *
 * Placeholder for a button that will export the current artwork or hall as a
 * vertical story image/video. It is intentionally NOT wired and renders nothing,
 * so it stays hidden from the UI until Phase 5 implements it.
 */
export type ExportStoryButtonProps = {
  museumSlug: string;
  hallId: string;
  artworkId?: string;
};

export function ExportStoryButton(props: ExportStoryButtonProps) {
  void props;
  return null;
}
