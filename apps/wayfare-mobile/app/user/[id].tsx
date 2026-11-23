import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Menu } from 'react-native-paper';
import { FollowButton } from '../../src/components/FollowButton';
import { GuidelinesGate } from '../../src/components/GuidelinesGate';
import { PostCard } from '../../src/components/PostCard';
import { ProfileHeader } from '../../src/components/ProfileHeader';
import { ReportDialog } from '../../src/components/ReportDialog';
import { useToast } from '../../src/context/ToastContext';
import { displayName, timeAgoPhrase } from '../../src/lib/format';
import { startDirect } from '../../src/social/chat';
import { block, getProfile, removeFollower } from '../../src/social/profiles';
import type { PublicProfile } from '../../src/social/types';
import { useFeed } from '../../src/social/useFeed';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Screen } from '../../src/ui/Screen';
import { SectionHeader } from '../../src/ui/SectionHeader';

function ProfileBody({ idParam }: { idParam: string }) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const isUsername = idParam.startsWith('@');
  const posts = useFeed('user', { userId: profile?.id ?? null, enabled: !!profile?.id });

  const load = useCallback(async () => {
    try {
      setProfile(await getProfile(isUsername ? { username: idParam.slice(1) } : { id: idParam }));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load profile');
      setProfile(null);
    }
  }, [idParam, isUsername, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (profile === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!profile) return <EmptyState icon="account-off-outline" title="Traveller not found" body="This profile may be private, blocked or deleted." />;

  const name = displayName(profile);

  const message = async () => {
    try {
      const id = await startDirect(profile.id);
      router.push(`/chat/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start a chat');
    }
  };

  const confirmBlock = () =>
    Alert.alert(`Block ${name}?`, 'They will not be able to see your profile, posts or message you, and you will not see theirs. They are not notified.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await block(profile.id);
            toast(`${name} is blocked`);
            router.back();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not block');
          }
        },
      },
    ]);

  return (
    <Screen onRefresh={() => { load(); posts.refresh(); }} refreshing={false}>
      <Stack.Screen
        options={{
          title: profile.username ? `@${profile.username}` : name,
          headerRight: profile.is_me
            ? undefined
            : () => (
                <Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<IconButton icon="dots-vertical" onPress={() => setMenu(true)} accessibilityLabel="More" />}>
                  {profile.follows_me ? (
                    <Menu.Item
                      leadingIcon="account-remove-outline"
                      title="Remove follower"
                      onPress={async () => {
                        setMenu(false);
                        await removeFollower(profile.id).catch(() => undefined);
                        load();
                      }}
                    />
                  ) : null}
                  <Menu.Item leadingIcon="flag-outline" title="Report profile" onPress={() => { setMenu(false); setReporting(true); }} />
                  <Menu.Item leadingIcon="account-cancel-outline" title="Block" onPress={() => { setMenu(false); confirmBlock(); }} />
                </Menu>
              ),
        }}
      />
      <ProfileHeader
        id={profile.id}
        name={name}
        username={profile.username}
        avatarPath={profile.avatar_path}
        bio={profile.bio}
        homeRegion={profile.home_region}
        homeCountry={profile.home_country}
        styles={profile.travel_styles ?? []}
        languages={profile.languages ?? []}
        tier={profile.tier}
        verifiedKm={profile.verified_km}
        maxAltitudeM={profile.max_altitude_m}
        trips={profile.trips_count}
        followers={profile.followers_count}
        following={profile.following_count}
        posts={profile.posts_count}
        actions={
          profile.is_me ? (
            <Button mode="contained-tonal" icon="pencil-outline" onPress={() => router.push('/profile/edit')} style={{ flex: 1 }}>
              Edit profile
            </Button>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <FollowButton userId={profile.id} following={profile.followed_by_me} compact={false} onChange={() => load()} />
              </View>
              <Button mode="outlined" icon="message-text-outline" onPress={message} disabled={!profile.can_message} style={{ flex: 1 }}>
                {profile.can_message ? 'Message' : 'Messages off'}
              </Button>
            </>
          )
        }
      />
      {profile.follows_me && !profile.is_me ? (
        <Button compact disabled style={{ alignSelf: 'flex-start', marginTop: 6 }} textColor={colors.muted}>
          Follows you
        </Button>
      ) : null}
      {profile.last_active_at ? (
        <Button compact disabled style={{ alignSelf: 'flex-start' }} textColor={colors.muted} icon="clock-outline">
          Active {timeAgoPhrase(profile.last_active_at)}
        </Button>
      ) : null}
      <SectionHeader title="Journeys & moments" />
      {posts.posts.length ? (
        posts.posts.map(p => <PostCard key={p.id} post={p} onChanged={posts.update} onDeleted={posts.remove} />)
      ) : posts.refreshing ? (
        <ActivityIndicator style={{ margin: 20 }} />
      ) : (
        <EmptyState compact icon="image-off-outline" title="No posts yet" />
      )}
      {!posts.done && posts.posts.length ? <Button onPress={posts.loadMore} loading={posts.loading}>Load more</Button> : null}
      <ReportDialog visible={reporting} onDismiss={() => setReporting(false)} targetType="profile" targetId={profile.id} onBlock={confirmBlock} />
    </Screen>
  );
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <GuidelinesGate what="see traveller profiles">
      <ProfileBody idParam={decodeURIComponent(String(id))} />
    </GuidelinesGate>
  );
}
