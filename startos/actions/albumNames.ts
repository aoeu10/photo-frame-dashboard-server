export type AlbumRow = {
  url: string
  name: string | null
  albumName: string | null
}

export type ImmichAlbumRow = {
  server: string
  apiKey: null
  album: string
  name: string | null
  albumName: string | null
}

type SyncedAlbum = {
  provider?: string | null
  name?: string | null
}

/**
 * Prefill rows for Edit Photos & Albums. `synced` is frame_cache.json's
 * photoAlbums. build_album_manifest emits iCloud albums first, then Immich
 * albums, so filtering by provider keeps each list aligned with its config
 * list; a shorter cache (not yet synced) yields null names.
 */
export function albumRows(
  albums: readonly { url?: string | null; name?: string | null }[],
  synced: readonly SyncedAlbum[],
): AlbumRow[] {
  const icloud = synced.filter((album) => album?.provider !== 'immich')
  return albums.map((album, index) => ({
    url: album?.url || '',
    name: album?.name || null,
    albumName: icloud[index]?.name || null,
  }))
}

export function immichAlbumRows(
  albums: readonly {
    server?: string | null
    albumId?: string | null
    name?: string | null
  }[],
  synced: readonly SyncedAlbum[],
): ImmichAlbumRow[] {
  const immich = synced.filter((album) => album?.provider === 'immich')
  return albums.map((album, index) => ({
    server: album?.server || '',
    // Never expose the saved API key. A blank field keeps it on save.
    apiKey: null,
    album: album?.albumId || '',
    name: album?.name || null,
    albumName: immich[index]?.name || null,
  }))
}
