import { COUPLE_TOOLS } from '@/components/toolkit/couple';
import { ToolRoute, useVisibleTools } from '@/components/toolkit/hub';

/** One couple planning tool (or why it isn't part of this celebration). */
export default function CoupleTool() {
  const visible = useVisibleTools(COUPLE_TOOLS);
  return <ToolRoute tools={COUPLE_TOOLS} visible={visible} settingsHref="/my-wedding" />;
}
