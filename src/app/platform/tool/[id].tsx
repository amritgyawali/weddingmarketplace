import { ToolRoute, useVisibleTools } from '@/components/toolkit/hub';
import { PLATFORM_TOOLS } from '@/components/toolkit/platform';

/** One operations tool (or which roles it is for). */
export default function PlatformTool() {
  const visible = useVisibleTools(PLATFORM_TOOLS);
  return <ToolRoute tools={PLATFORM_TOOLS} visible={visible} />;
}
