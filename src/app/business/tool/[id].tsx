import { ToolRoute } from '@/components/toolkit/hub';
import { VENDOR_TOOLS } from '@/components/toolkit/vendor';

/** One vendor business tool. */
export default function BusinessTool() {
  return <ToolRoute tools={VENDOR_TOOLS} />;
}
