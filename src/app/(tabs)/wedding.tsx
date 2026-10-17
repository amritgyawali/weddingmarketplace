import { MyWeddingScreen } from '@/components/wedding/MyWeddingScreen';
import { deferredScreen } from '@/components/ui/DeferredScreen';

/** "My wedding" tab: the couple's plan, quotes, payments and team, one tap from anywhere. */
function WeddingTab() {
  return <MyWeddingScreen inTab />;
}

// Heavy screen: answer the tap with a light frame first (components/ui/DeferredScreen.tsx).
export default deferredScreen(WeddingTab);
