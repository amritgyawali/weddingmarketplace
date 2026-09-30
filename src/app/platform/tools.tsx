import { ToolHub } from '@/components/toolkit/hub';
import { PLATFORM_TOOLS } from '@/components/toolkit/platform';

/** Extra operations tools for platform staff. */
export default function PlatformTools() {
  return <ToolHub role="platform" tools={PLATFORM_TOOLS} title="Operations tools" subtitle="20 tools for the ops team" />;
}
