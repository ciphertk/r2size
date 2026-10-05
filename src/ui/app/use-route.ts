import { useSyncExternalStore } from 'react';
import { currentRoute, subscribeToRoute, type Route } from '../../infra/route';

/** The current route; re-renders on Back/Forward and in-app navigation. */
export const useRoute = (): Route =>
  useSyncExternalStore(subscribeToRoute, currentRoute, () => 'calculator');
