import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.2.75:0',
  releaseNotes: {
    en_US:
      "**Immich photo albums.** Edit Photos & Albums now has an **Immich albums** list alongside the existing iCloud shared albums. Each Immich row takes the server base URL (LAN address or reverse-proxy subpath), an API key with `album.read`, `asset.view` and `asset.read`, an album page link or album ID, and an optional label. The box reads album metadata on the sync interval, skips videos and trashed assets, and serves every image through `/api/immich/photo/...`; the frame never contacts Immich directly and the API key stays on the box. Photo Album Info now shows each album's source (iCloud or Immich) and server. iCloud album behaviour is unchanged.",
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
