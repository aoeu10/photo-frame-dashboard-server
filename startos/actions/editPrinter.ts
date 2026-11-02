import { sdk } from '../sdk'
import {
  configJson,
  DEFAULT_PRINTER_SCAN_SUBNET,
} from '../fileModels/config.json'
import { manifest } from '../manifest'
import {
  discoveredPrinter,
  discoverPrintersOnLan,
  type DiscoveredPrinter,
} from './printerDiscovery'

const { InputSpec, Value } = sdk
const printerSetupGuide = `[Find your printer's IPP URL in the README](${manifest.packageRepo}#find-your-printers-ipp-url)`
const MANUAL_PRINTER = 'manual'
type Effects = Parameters<typeof configJson.merge>[0]
type PrinterForm = {
  discovered: string
  name: string | null
  url: string | null
  scanSubnet: string | null
}
// The SDK builds the spec before asking for initial values. Share that one
// search within this request, not across form openings or service restarts.
const initialValues = new WeakMap<Effects, PrinterForm>()

export const editPrinter = sdk.Action.withInput(
  '10-edit-printer',
  {
    name: 'Printer Settings',
    description:
      'Opening these settings searches the LAN (up to about 30 seconds). If one printer is found and none is saved, its name and URL are filled in. ' +
      'Select a discovered printer or enter its IPP URL manually, then Submit to save. Opening the form never changes the saved printer.\n\n' +
      printerSetupGuide,
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  async ({ effects }) => {
    const cfg = await configJson.read().once()
    const scanSubnet =
      (cfg?.printer?.scanSubnet || '').trim() || DEFAULT_PRINTER_SCAN_SUBNET
    let printers: DiscoveredPrinter[] = []
    let error = ''
    try {
      printers = await discoverPrintersOnLan(effects, scanSubnet)
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure)
    }
    let name = cfg?.printer?.name || null
    let url = cfg?.printer?.url || null
    if (!url && printers.length === 1) {
      name = printers[0].name
      url = printers[0].url
    }
    initialValues.set(effects, {
      discovered: MANUAL_PRINTER,
      name,
      url,
      scanSubnet,
    })
    const values: Record<string, string> = {
      [MANUAL_PRINTER]: 'Use the name and URL fields below',
    }
    for (const printer of printers) {
      const label = printer.model
        ? `${printer.name} (${printer.model})`
        : printer.name
      values[JSON.stringify(printer)] = `${label} — ${printer.url}`
    }
    const description = error
      ? error +
        '\n\nManual entry is still available. Check Scan subnet below.\n\n' +
        printerSetupGuide
      : printers.length === 0
        ? cfg?.printer?.url
          ? 'No compatible printers were found. Your saved URL remains below; you can keep or edit it.'
          : 'No compatible printers were found. Enter an IPP URL manually.'
        : `${printers.length} printer(s) found. ` +
          (url && !cfg?.printer?.url
            ? 'The only result is filled in below; submit to save it. '
            : cfg?.printer?.url
              ? 'Your saved printer is kept below. '
              : 'Choose a printer or enter its URL manually. ') +
          'Selecting a result overrides the name and URL fields when submitted.'
    const scanResult = error
      ? 'This LAN search failed; no discovery result is available.'
      : printers.length
        ? `This LAN search found ${printers.length} compatible printer(s): ` +
          printers
            .map((printer) => `${printer.name} — ${printer.url}`)
            .join('; ') +
          '.'
        : 'This LAN search completed: no compatible printers were found.'
    const urlSource = cfg?.printer?.url
      ? printers.some((printer) => printer.url === cfg.printer.url)
        ? 'Your saved URL was also returned by this search and is kept below.'
        : 'The URL below was loaded from your saved settings, not from this search.'
      : printers.length === 1
        ? 'The name and URL below were filled from this search. Submit to save them.'
        : printers.length > 1
          ? 'No printer URL is saved. Choose a discovered printer or enter a URL manually.'
          : 'No printer URL is saved. Enter a URL manually.'
    return InputSpec.of({
      discovered: Value.select({
        name: 'Discovered printers',
        description,
        footnote: scanResult + ' ' + urlSource,
        default: MANUAL_PRINTER,
        values,
      }),
      name: Value.text({
        name: 'Printer name (optional)',
        description:
          'Friendly label for manual setup. Selecting a discovered printer uses its reported name instead.',
        required: false,
        default: null,
      }),
      url: Value.text({
        name: 'Printer URL',
        description:
          'Use the full IPP/IPPS address, for example ipp://192.168.1.50:631/ipp/print. ' +
          'Save it once here; the dashboard Print button uses it automatically. A discovered selection overrides this field. To remove the saved printer, choose "Use the name and URL fields below" and clear this URL.\n\n' +
          printerSetupGuide,
        required: false,
        default: null,
        patterns: [
          {
            regex: '^(ipp|ipps)://\\S+$',
            description: 'Must start with ipp:// or ipps://',
          },
        ],
      }),
      scanSubnet: Value.text({
        name: 'Scan subnet (optional)',
        description:
          'Defaults to 192.168.1.0/24 (192.168.1.1 through 192.168.1.254). Enter a different private IPv4 subnet if your printer is on another network. Leaving this blank uses the default, not container-network detection. ' +
          'Submit and reopen these settings to search a changed subnet. Discovery probes ports 631 and 443 and queries IPP without printing. Maximum 1024 addresses per search.',
        required: false,
        default: DEFAULT_PRINTER_SCAN_SUBNET,
      }),
    })
  },
  async ({ effects }) => {
    const value = initialValues.get(effects)
    initialValues.delete(effects)
    if (!value) throw new Error('Printer settings were not initialized.')
    return value
  },
  async ({ effects, input }) => {
    let url = (input.url || '').trim()
    let name = (input.name || '').trim()
    if (input.discovered !== MANUAL_PRINTER) {
      const selected = discoveredPrinter.parse(JSON.parse(input.discovered))
      url = selected.url
      name = selected.name
    }
    const scanSubnet =
      (input.scanSubnet || '').trim() || DEFAULT_PRINTER_SCAN_SUBNET
    await configJson.merge(effects, { printer: { name, url, scanSubnet } })
    return {
      version: '1',
      title: 'Printer settings saved',
      result: null,
      message: url
        ? 'Saved ' +
          url +
          '. The Groceries Print button sends to this printer without a dialog.'
        : scanSubnet
          ? 'Scan subnet saved: ' +
            scanSubnet +
            '. Reopen Printer Settings to search it.'
          : 'No default printer set. Reopen Printer Settings to search, or enter a URL manually.',
    }
  },
)
