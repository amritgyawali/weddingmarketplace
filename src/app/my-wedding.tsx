import { MyWeddingScreen } from '@/components/wedding/MyWeddingScreen';
import { deferredScreen } from '@/components/ui/DeferredScreen';

/** `/my-wedding`: the stack version of the "My wedding" tab, opened by deep links and notifications. */
function MyWedding() {
  return <MyWeddingScreen />;
}

// Heavy screen: answer the tap with a light frame first (components/ui/DeferredScreen.tsx).
export default deferredScreen(MyWedding);
