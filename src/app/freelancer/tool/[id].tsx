import { FREELANCER_TOOLS } from '@/components/toolkit/freelancer';
import { ToolRoute } from '@/components/toolkit/hub';

/** One freelancer tool. */
export default function FreelancerTool() {
  return <ToolRoute tools={FREELANCER_TOOLS} />;
}
