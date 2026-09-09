'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createDetailNavigation,
  type DetailNavigationSnapshot,
} from '@/lib/detail-navigation';

export function useDetailNavigation(
  capture: () => DetailNavigationSnapshot,
  restore: (snapshot: DetailNavigationSnapshot) => void,
  canGoBack: () => boolean,
) {
  const callbacks = useRef({ capture, restore, canGoBack });
  const controller = useRef<ReturnType<typeof createDetailNavigation> | null>(
    null,
  );
  // Each request needs a fresh ticket, even a rapid Back → Forward that returns
  // to the same cached snapshot before React renders.
  const [commitTicket, setCommitTicket] = useState<{
    snapshot: DetailNavigationSnapshot;
  } | null>(null);
  useEffect(() => {
    callbacks.current = { capture, restore, canGoBack };
  });
  useEffect(() => {
    if (commitTicket) controller.current?.committed(commitTicket.snapshot);
  }, [commitTicket]);
  useEffect(() => {
    const originalScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const navigation = createDetailNavigation(
      window.history,
      () => callbacks.current.capture(),
      (snapshot) => {
        callbacks.current.restore(snapshot);
        setCommitTicket({ snapshot });
      },
      () => crypto.randomUUID(),
      () => callbacks.current.canGoBack(),
    );
    controller.current = {
      ...navigation,
      push(snapshot) {
        const accepted = navigation.push(snapshot);
        if (accepted) setCommitTicket({ snapshot });
        return accepted;
      },
      replace(snapshot, resetTrail) {
        const accepted = navigation.replace(snapshot, resetTrail);
        if (accepted) setCommitTicket({ snapshot });
        return accepted;
      },
    };
    const pop = (event: PopStateEvent) => navigation.pop(event.state);
    const save = () => navigation.save();
    window.addEventListener('popstate', pop);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('pagehide', save);
      window.history.scrollRestoration = originalScrollRestoration;
      controller.current = null;
    };
  }, []);
  return controller;
}
