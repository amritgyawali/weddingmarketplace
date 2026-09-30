import { ToolRoute } from '@/components/toolkit/hub';
import { PLATFORM_TOOLS } from '@/components/toolkit/platform';

/** One operations tool. */
export default function PlatformTool() {
  return <ToolRoute tools={PLATFORM_TOOLS} />;
}
