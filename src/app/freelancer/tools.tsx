import { FREELANCER_TOOLS } from '@/components/toolkit/freelancer';
import { ToolHub, useVisibleTools } from '@/components/toolkit/hub';

/** Extra tools for freelancers, picked for their craft. */
export default function FreelancerTools() {
  const tools = useVisibleTools(FREELANCER_TOOLS);
  return <ToolHub role="freelancer" tools={tools} title="Freelancer tools" subtitle={`${tools.length} tools for your work and money`} />;
}
