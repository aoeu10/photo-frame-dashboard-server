export type AlbumRow = {
  url: string
  name: string | null
  albumName: string | null
}

/**
 * Prefill rows for Edit Photos & Albums. `synced` is frame_cache.json's
 * photoAlbums, which build_album_manifest emits in config album order, so the
 * index maps one-to-one; a shorter cache (not yet synced) yields null names.
 */
export function albumRows(
  albums: readonly { url?: string | null; name?: string | null }[],
  synced: readonly { name?: string | null }[],
): AlbumRow[] {
  return albums.map((album, index) => ({
    url: album?.url || '',
    name: album?.name || null,
    albumName: synced[index]?.name || null,
  }))
}
