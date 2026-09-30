import { FREELANCER_TOOLS } from '@/components/toolkit/freelancer';
import { ToolRoute, useVisibleTools } from '@/components/toolkit/hub';

/** One freelancer tool (or why it isn't available for this craft). */
export default function FreelancerTool() {
  const visible = useVisibleTools(FREELANCER_TOOLS);
  return <ToolRoute tools={FREELANCER_TOOLS} visible={visible} settingsHref="/freelancer/craft" />;
}
