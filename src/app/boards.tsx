import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, KField } from '@/components/kit';
import { ToolScreen, toolStyles } from '@/components/planner/ToolScreen';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { photos } from '@/constants/images';
import { IDEA_PHOTOS } from '@/data/ideas';
import { useLayout } from '@/hooks/useLayout';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { InspirationBoard, Project } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { shareMessage } from '@/utils/links';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const photoById = (id: string) => IDEA_PHOTOS.find((p) => p.id === id);
const STARTERS = ['Decor & mandap', 'Bridal look', 'Groom look', 'Mehendi', 'Reception', 'Cake & desserts'];

function BoardView({ board, readOnly, onBack }: { board: InspirationBoard; readOnly: boolean; onBack: () => void }) {
  const t = useRoleTheme();
  const { width, columns } = useLayout();
  const toggle = useDb((s) => s.toggleBoardItem);
  const rename = useDb((s) => s.renameBoard);
  const remove = useDb((s) => s.deleteBoard);
  const liked = useAppStore((s) => s.likedPhotos);
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [name, setName] = useState(board.name);
  const cols = Math.max(2, columns + 1);
  const size = (Math.min(width, 1100) - 32 - (cols - 1) * 8) / cols;
  const categories = [...new Set(IDEA_PHOTOS.map((p) => p.category))];
  const pool = IDEA_PHOTOS.filter((p) => !filter || (filter === 'Liked' ? liked.includes(p.id) : p.category === filter));

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}>
        <Pressable onPress={onBack} style={toolStyles.row} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={t.c.primary} />
          <Text size={14} weight="semibold" color={t.c.primary}>
            All boards
          </Text>
        </Pressable>
        {readOnly ? (
          <Text size={22} weight="bold" color={t.c.textStrong}>
            {board.name}
          </Text>
        ) : (
          <KField value={name} onChangeText={setName} onBlur={() => name.trim() && rename(board.id, name.trim())} />
        )}
        <View style={toolStyles.row}>
          {!readOnly && <KButton label="Add ideas" icon="add" size="sm" style={{ flex: 1 }} onPress={() => setPicking(true)} />}
          <KButton
            label="Share with vendors"
            icon="share-social-outline"
            variant="secondary"
            size="sm"
            style={{ flex: 1.2 }}
            onPress={() => shareMessage(`Our “${board.name}” inspiration board (${board.items.length} ideas):\n${board.items.map((id) => `• ${photoById(id)?.title ?? id}`).join('\n')}`)}
          />
        </View>
        {board.items.length === 0 ? (
          <EmptyBlock icon="images-outline" title="Empty board" message="Add photos from Ideas — share the board with your decorator, makeup artist or photographer." />
        ) : (
          <View style={styles.grid}>
            {board.items.map((id) => {
              const p = photoById(id);
              if (!p) return null;
              return (
                <View key={id} style={{ width: size }}>
                  <Photo source={photos[p.image]} style={{ width: size, height: size * 1.25, borderRadius: 8 }} contentFit="cover" />
                  <Text size={12} color={t.c.text} numberOfLines={2} style={{ marginTop: 4 }}>
                    {p.title}
                  </Text>
                  {!readOnly && (
                    <Pressable onPress={() => toggle(board.id, id)} style={styles.remove} accessibilityLabel="Remove from board" hitSlop={6}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
        {!readOnly && (
          <KButton
            label="Delete board"
            icon="trash-outline"
            variant="ghost"
            size="sm"
            onPress={() =>
              confirm('Delete board?', board.name, 'Delete', () => {
                remove(board.id);
                onBack();
              })
            }
          />
        )}
      </ScrollView>
      <Sheet visible={picking} onClose={() => setPicking(false)} title="Add ideas">
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <ChoiceChips options={['Liked', ...categories]} selected={filter ? [filter] : []} onToggle={(c) => setFilter(filter === c ? null : c)} />
          <FlatList
            data={pool}
            numColumns={3}
            keyExtractor={(p) => p.id}
            style={{ maxHeight: 420 }}
            columnWrapperStyle={{ gap: 6 }}
            contentContainerStyle={{ gap: 6 }}
            ListEmptyComponent={<Text size={13} color={t.c.muted}>Nothing here — like photos in Ideas to see them.</Text>}
            renderItem={({ item }) => {
              const on = board.items.includes(item.id);
              return (
                <Pressable onPress={() => toggle(board.id, item.id)} style={{ flex: 1 / 3 }}>
                  <Photo source={photos[item.image]} style={{ width: '100%', aspectRatio: 0.8, borderRadius: 10, opacity: on ? 0.6 : 1 }} contentFit="cover" />
                  {on && <Ionicons name="checkmark-circle" size={24} color={t.c.primary} style={styles.tick} />}
                </Pressable>
              );
            }}
          />
          <KButton label="Done" onPress={() => { setPicking(false); toast('Board updated', 'images'); }} />
        </View>
      </Sheet>
    </>
  );
}

function Boards({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const t = useRoleTheme();
  const { columns } = useLayout();
  const all = useDb((s) => s.boards);
  const addBoard = useDb((s) => s.addBoard);
  const boards = all.filter((b) => b.projectId === project.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const open = boards.find((b) => b.id === openId);

  if (open) return <BoardView key={open.id} board={open} readOnly={readOnly} onBack={() => setOpenId(null)} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      {!readOnly && (
        <Card style={{ gap: 10 }}>
          <Text size={15} weight="bold" color={t.c.textStrong}>
            New board
          </Text>
          <View style={toolStyles.row}>
            <View style={{ flex: 1 }}>
              <KField placeholder="e.g. Reception decor" value={name} onChangeText={setName} />
            </View>
            <KButton
              label="Create"
              size="sm"
              disabled={!name.trim()}
              onPress={() => {
                setOpenId(addBoard(project.id, name));
                setName('');
              }}
            />
          </View>
          <ChoiceChips options={STARTERS.filter((s) => !boards.some((b) => b.name === s))} selected={[]} onToggle={(s) => setOpenId(addBoard(project.id, s))} />
        </Card>
      )}
      {boards.length === 0 ? (
        <EmptyBlock icon="images-outline" title="Collect your inspiration" message="Group photos by theme and share them with the people creating your look and décor." />
      ) : (
        <View style={styles.grid}>
          {boards.map((b) => {
            const covers = b.items.slice(0, 3).map(photoById).filter(Boolean);
            return (
              <Card key={b.id} onPress={() => setOpenId(b.id)} padded={false} style={{ width: columns > 1 ? '31.5%' : '48%', overflow: 'hidden' }}>
                <View style={styles.cover}>
                  {covers.length ? (
                    covers.map((p) => <Photo key={p!.id} source={photos[p!.image]} style={{ flex: 1, height: '100%' }} contentFit="cover" />)
                  ) : (
                    <View style={[styles.placeholder, { backgroundColor: t.c.soft }]}>
                      <Ionicons name="images-outline" size={28} color={t.c.primary} />
                    </View>
                  )}
                </View>
                <View style={{ padding: 10 }}>
                  <Text size={14} weight="bold" color={t.c.textStrong} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {b.items.length} ideas
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/** Mood boards: collect ideas by theme and share them with vendors. */
export default function BoardsScreen() {
  return (
    <ToolScreen title="Mood boards" subtitle={(p) => p.title}>
      {(project, { readOnly }) => <Boards project={project} readOnly={readOnly} />}
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  cover: { flexDirection: 'row', height: 110, gap: 2 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute', top: 6, right: 6 },
});
