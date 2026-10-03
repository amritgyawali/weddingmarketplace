import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { StackHeader } from '@/components/kit';
import { SocialComposer } from '@/components/social/Composer';
import { useRoleTheme } from '@/theme/RoleTheme';

/** New post (or edit a draft) for every connected network. `?at=` pre-fills the schedule. */
export default function ComposeSocialPost() {
  const t = useRoleTheme();
  const { id, at } = useLocalSearchParams<{ id?: string; at?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={id ? 'Edit post' : 'New post'} subtitle="One post for Facebook, Instagram, WhatsApp and TikTok" />
      <SocialComposer postId={id} at={at} />
    </View>
  );
}
