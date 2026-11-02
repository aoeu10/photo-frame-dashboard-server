import { i18n } from './i18n'
import { sdk } from './sdk'

// One plain-HTTP web interface on port 80. LAN addresses (the `.local`
// hostname and the server's LAN IP) are enabled by default and carry no
// authentication — that is what the frame uses. If the owner later exposes
// the service over the internet (a public domain with SSL from the
// Interfaces tab), StartOS's reverse proxy can gate that address with an
// auth requirement; the package itself needs no code for either case.
export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const multi = sdk.MultiHost.of(effects, 'ui')
  const origin = await multi.bindPort(80, {
    protocol: 'http',
    preferredExternalPort: 80,
  })

  const ui = sdk.createInterface(effects, {
    name: i18n('Web Interface'),
    id: 'ui',
    description: i18n('The main web interface'),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })

  return [await origin.export([ui])]
})
