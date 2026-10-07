import { useCallback, useEffect, useRef, useState } from 'react';
import { feedPage } from './feed';
import type { FeedMode, FeedPost } from './types';

const PAGE = 20;

/** Paginated feed (cursor by created_at; offset for trending) with optimistic local edits. */
export function useFeed(mode: FeedMode, opts: { placeKey?: string | null; userId?: string | null; enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const generation = useRef(0);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!enabled || inflight.current) return;
      inflight.current = true;
      const gen = reset ? ++generation.current : generation.current;
      if (reset) setRefreshing(true);
      else setLoading(true);
      try {
        const current = reset ? [] : posts;
        const page = await feedPage({
          mode,
          placeKey: opts.placeKey,
          userId: opts.userId,
          before: current.length ? current[current.length - 1].created_at : null,
          offset: current.length,
          limit: PAGE,
        });
        if (gen !== generation.current) return;
        setPosts(reset ? page : [...current, ...page.filter(p => !current.some(c => c.id === p.id))]);
        setDone(page.length < PAGE);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the feed');
      } finally {
        inflight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enabled, mode, opts.placeKey, opts.userId, posts]
  );

  useEffect(() => {
    setPosts([]);
    setDone(false);
    if (enabled) {
      inflight.current = false;
      fetchPage(true);
    }
    // Reset whenever the feed definition changes.
  }, [mode, opts.placeKey, opts.userId, enabled]);

  return {
    posts,
    loading,
    refreshing,
    done,
    error,
    refresh: () => fetchPage(true),
    loadMore: () => {
      if (!done && !loading && posts.length) fetchPage(false);
    },
    update: (post: FeedPost) => setPosts(prev => prev.map(p => (p.id === post.id ? post : p))),
    remove: (id: string) => setPosts(prev => prev.filter(p => p.id !== id)),
    removeAuthor: (userId: string) => setPosts(prev => prev.filter(p => p.user_id !== userId)),
  };
}
