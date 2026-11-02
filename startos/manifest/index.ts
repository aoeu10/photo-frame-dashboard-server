import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'frame-dashboard',
  title: 'Frame Dashboard',
  license: 'MIT',
  packageRepo: 'https://github.com/aoeu10/photo-frame-dashboard-server',
  upstreamRepo: 'https://github.com/wesbos/photo-frame-dashboard',
  marketingUrl: 'https://github.com/aoeu10/photo-frame-dashboard-server',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    main: {
      source: { dockerBuild: {} },
      arch: ['x86_64', 'aarch64'],
    },
  },
})
