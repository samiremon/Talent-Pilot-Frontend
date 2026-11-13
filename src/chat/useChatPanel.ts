/**
 * Remembers how the AI chat panel is shown: 'open' (docked on the right),
 * 'expanded' (full width) or 'minimized' (hidden behind the round bot button).
 *
 * Desktop: the choice is saved in the browser (localStorage), so a refresh keeps it.
 * Phones: the chat always starts minimized, because open it covers the whole screen.
 */
import { useCallback, useEffect, useState } from 'react';

export type ChatMode = 'open' | 'expanded' | 'minimized';

const STORAGE_KEY = 'talentpilot.chatMode';
const PHONE_QUERY = '(max-width: 900px)';

/** Reads the saved mode. Storage can be blocked (private mode), so never let it crash. */
function readSavedMode(): ChatMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'open' || saved === 'expanded' || saved === 'minimized') return saved;
  } catch {
    // Storage not available: fall through to the default.
  }
  // The assignment is "chat-first", so the chat is open unless the user closed it.
  return 'open';
}

function saveMode(mode: ChatMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Not saving is fine; it just won't be remembered after a refresh.
  }
}

/** True while the screen is phone-sized. Updates live when the window is resized. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isPhone;
}

export function useChatPanel() {
  const isPhone = useIsPhone();
  const [desktopMode, setDesktopMode] = useState<ChatMode>(readSavedMode);
  // Phones keep their own, unsaved state that always starts minimized.
  const [phoneMode, setPhoneMode] = useState<ChatMode>('minimized');

  const mode = isPhone ? phoneMode : desktopMode;

  const setMode = useCallback(
    (next: ChatMode) => {
      if (isPhone) {
        setPhoneMode(next);
      } else {
        setDesktopMode(next);
        saveMode(next);
      }
    },
    [isPhone],
  );

  return {
    mode,
    open: () => setMode('open'),
    minimize: () => setMode('minimized'),
    /** Switches between docked and full width. */
    toggleExpanded: () => setMode(mode === 'expanded' ? 'open' : 'expanded'),
  };
}
