import { ToolHub } from '@/components/toolkit/hub';
import { VENDOR_TOOLS } from '@/components/toolkit/vendor';

/** Extra business tools for vendors. */
export default function BusinessTools() {
  return <ToolHub role="vendor" tools={VENDOR_TOOLS} title="Business tools" subtitle="20 tools to run the business" />;
}
