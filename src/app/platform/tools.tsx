import { ToolHub, useVisibleTools } from '@/components/toolkit/hub';
import { PLATFORM_TOOLS } from '@/components/toolkit/platform';

/** Extra operations tools for platform staff, picked by their permissions. */
export default function PlatformTools() {
  const tools = useVisibleTools(PLATFORM_TOOLS);
  return <ToolHub role="platform" tools={tools} title="Operations tools" subtitle={`${tools.length} tools for your role`} />;
}
