import { ScreenOrientation } from '@capacitor/screen-orientation'

/**
 * Locks the device to a game's orientation while it is on screen, through the
 * native Capacitor plugin (a real lock on iOS and Android; in a plain browser the
 * plugin falls back to the web Screen Orientation API where it exists). Never
 * throws: a device or browser that will not lock just stays as it was.
 */
export async function lockGameOrientation(orientation: 'portrait' | 'landscape'): Promise<void> {
  try {
    await ScreenOrientation.lock({ orientation })
  } catch {
    /* cannot lock here: the game still plays */
  }
}

export async function unlockGameOrientation(): Promise<void> {
  try {
    await ScreenOrientation.unlock()
  } catch {
    /* nothing was locked, or it cannot be unlocked here */
  }
}
