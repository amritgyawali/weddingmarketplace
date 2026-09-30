import { ToolRoute, useVisibleTools } from '@/components/toolkit/hub';
import { VENDOR_TOOLS } from '@/components/toolkit/vendor';

/** One vendor business tool (or why it isn't available for this business). */
export default function BusinessTool() {
  const visible = useVisibleTools(VENDOR_TOOLS);
  return <ToolRoute tools={VENDOR_TOOLS} visible={visible} settingsHref="/business/services" />;
}
