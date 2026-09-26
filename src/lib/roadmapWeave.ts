/**
 * The path's left/right rhythm: a smooth sine-like sway, one value per node in
 * course order across the WHOLE course (never restarting per module), as a
 * multiple of the row amplitude (`--rm-amp`). A period of eight nodes is long
 * enough to read as a winding road rather than a zigzag.
 */
const SWAY = [0, 0.6, 1, 0.6, 0, -0.6, -1, -0.6] as const

export function weaveOffset(index: number): number {
  return SWAY[index % SWAY.length]
}
