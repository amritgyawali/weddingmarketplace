import { ToolHub, useVisibleTools } from '@/components/toolkit/hub';
import { VENDOR_TOOLS } from '@/components/toolkit/vendor';

/** Business tools, picked for the services this vendor offers. */
export default function BusinessTools() {
  const tools = useVisibleTools(VENDOR_TOOLS);
  return <ToolHub role="vendor" tools={tools} title="Business tools" subtitle={`${tools.length} tools for your business`} />;
}
