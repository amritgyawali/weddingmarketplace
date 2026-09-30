import { FREELANCER_TOOLS } from '@/components/toolkit/freelancer';
import { ToolHub } from '@/components/toolkit/hub';

/** Extra tools for freelancers. */
export default function FreelancerTools() {
  return <ToolHub role="freelancer" tools={FREELANCER_TOOLS} title="Freelancer tools" subtitle="20 tools for your work and money" />;
}
