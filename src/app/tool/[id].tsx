import { COUPLE_TOOLS } from '@/components/toolkit/couple';
import { ToolRoute } from '@/components/toolkit/hub';

/** One couple planning tool. */
export default function CoupleTool() {
  return <ToolRoute tools={COUPLE_TOOLS} />;
}
