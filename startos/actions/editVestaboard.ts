import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'

const { InputSpec, Value } = sdk

const BOARD_VALUES = {
  flagship: 'Flagship (6 rows × 22 columns)',
  note: 'Note (3 rows × 15 columns)',
} as const

type VestaboardForm = {
  host: string
  apiKey?: string | null
  board: 'flagship' | 'note'
}

function isPrivateIPv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!match) return false
  const parts = match.slice(1).map(Number)
  if (parts.some((part) => part < 0 || part > 255)) return false
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127
  )
}

function isLocalHostname(host: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.local$/i.test(
    host,
  )
}

function normalizeHost(value: string): string {
  let host = value.trim()
  host = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  host = host.replace(/:\d+$/, '')
  return host
}

export const editVestaboard = sdk.Action.withInput(
  '11-edit-vestaboard',
  {
    name: 'Vestaboard Settings',
    description:
      'Connect the frame to a Vestaboard on the same private network. Enable the Local API in the Vestaboard app, then enter its IPv4 address (or vestaboard.local) and the Local API key. The key stays on this server and is never sent to the frame.',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  InputSpec.of({
    host: Value.text({
      name: 'Vestaboard address',
      description:
        'Private IPv4 address or .local hostname, for example 192.168.1.60 or vestaboard.local. Port 7000 is used automatically; do not include a URL path.',
      required: true,
      default: null,
    }),
    apiKey: Value.text({
      name: 'Local API key',
      description:
        'Leave blank to keep the saved key. In the Vestaboard app, enable the Local API and copy the key it returns.',
      required: false,
      default: null,
    }),
    board: Value.select({
      name: 'Board size',
      description:
        'Choose the model so the drawing grid and VBML composer match its character layout.',
      default: 'flagship',
      values: BOARD_VALUES,
    }),
  }),
  async () => {
    const cfg = await configJson.read().once()
    const saved = cfg?.vestaboard
    return {
      host: saved?.host || undefined,
      apiKey: undefined,
      board: saved?.board || 'flagship',
    }
  },
  async ({ effects, input }) => {
    const form = input as VestaboardForm
    const rawHost = String(form.host || '').trim()
    const port = /:(\d+)\/?$/.exec(rawHost.replace(/^https?:\/\//i, ''))
    if (port && port[1] !== '7000') {
      throw new Error('The Vestaboard Local API uses port 7000.')
    }
    const host = normalizeHost(rawHost)
    if (!host || (!isPrivateIPv4(host) && !isLocalHostname(host))) {
      throw new Error(
        'Enter a private IPv4 address (10.x, 172.16–31.x or 192.168.x) or a .local hostname.',
      )
    }
    const cfg = await configJson.read().once()
    const saved = cfg?.vestaboard
    const apiKey = String(form.apiKey || '').trim() || saved?.apiKey || ''
    if (!apiKey) {
      throw new Error(
        'Enter the Vestaboard Local API key. Enable the Local API in the Vestaboard app first.',
      )
    }
    const board = form.board === 'note' ? 'note' : 'flagship'
    await configJson.merge(effects, { vestaboard: { host, apiKey, board } })
    return {
      version: '1',
      title: 'Vestaboard settings saved',
      result: null,
      message:
        'The frame can now open the Vestaboard section. Its Local API key stays on this server.',
    }
  },
)
