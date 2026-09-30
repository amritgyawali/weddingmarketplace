import { COUPLE_TOOLS } from '@/components/toolkit/couple';
import { ToolHub, useVisibleTools } from '@/components/toolkit/hub';
import { useExperience } from '@/hooks/useExperience';

/** Extra planning tools for the couple, picked for what they are celebrating. */
export default function CoupleTools() {
  const tools = useVisibleTools(COUPLE_TOOLS);
  const exp = useExperience();
  return <ToolHub role="customer" tools={tools} title="Planning tools" subtitle={`${tools.length} tools for your ${exp.vocab.noun}`} />;
}
