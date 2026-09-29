import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { EmptyBlock, StackHeader } from '@/components/kit';
import { ProjectWorkspace } from '@/components/work/ProjectWorkspace';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';

export default function PlatformProject() {
  const t = useRoleTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useDb((s) => s.projects.find((p) => p.id === id));

  if (!project) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Project" />
        <EmptyBlock title="Project not found" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader
        title={project.title}
        subtitle={`${project.code} · ${project.city} · ${project.managedBy === 'platform' ? 'Genie managed' : 'Self managed'}`}
        right={
          <Pressable
            onPress={() => router.push({ pathname: '/platform/gig/new', params: { projectId: project.id } })}
            hitSlop={10}
            accessibilityLabel="Post a crew gig for this wedding"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-add-outline" size={19} color="#FFFFFF" />
          </Pressable>
        }
      />
      <ProjectWorkspace project={project} mode="platform" />
    </View>
  );
}
