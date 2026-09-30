import { COUPLE_TOOLS } from '@/components/toolkit/couple';
import { ToolHub } from '@/components/toolkit/hub';

/** Extra planning tools for the couple. */
export default function CoupleTools() {
  return <ToolHub role="customer" tools={COUPLE_TOOLS} title="Planning tools" subtitle="20 extra tools for your wedding" />;
}
