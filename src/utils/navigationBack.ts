/** Minimal navigation state shape (avoids @react-navigation/native import). */
type NavRoute = {
  state?: NavState;
};

type NavState = {
  index?: number;
  routes?: NavRoute[];
};

/** Expo Router navigation object (structural typing kept loose for TS). */
export type NavLike = {
  getState: () => NavState | undefined;
  getParent?: () => NavLike | undefined;
  goBack: () => void;
};

function asNavState(state: NavState | undefined): NavState | undefined {
  return state;
}

/** True if this navigation state (or a nested child) can pop. */
export function stateCanPop(state: NavState | undefined): boolean {
  if (!state?.routes?.length) return false;

  const index = state.index ?? 0;
  if (index > 0) return true;

  const current = state.routes[index];
  if (current?.state && stateCanPop(current.state)) return true;

  return false;
}

/** Walk up navigators — true when any level can go back. */
export function navigationCanPop(navigation: unknown): boolean {
  let nav = navigation as NavLike | undefined;
  while (nav) {
    try {
      if (stateCanPop(asNavState(nav.getState()))) return true;
    } catch {
      return false;
    }
    nav = nav.getParent?.();
  }
  return false;
}
