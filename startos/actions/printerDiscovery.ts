import { z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'

export const discoveredPrinter = z.object({
  name: z.string(),
  url: z.string().regex(/^ipps?:\/\/\S+$/),
  model: z.string().optional(),
})
const discoveredPrinterList = z.array(discoveredPrinter)
export type DiscoveredPrinter = z.infer<typeof discoveredPrinter>

type Effects = Parameters<typeof configJson.merge>[0]

export async function discoverPrintersOnLan(
  effects: Effects,
  scanSubnet: string,
): Promise<DiscoveredPrinter[]> {
  try {
    return await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'main' },
      null,
      'printer-lan-discovery',
      async (sub) => {
        const script = [
          'import sys, json',
          'sys.path.insert(0, "/opt/pydeps")',
          'sys.path.insert(0, "/opt/dashboard_service")',
          'from grocery_print import discover_printers',
          'scope = sys.argv[1].strip()',
          'printers = discover_printers(timeout=3, force=True, subnets=[scope] if scope else None)',
          'print(json.dumps(printers))',
        ].join('\n')

        const result = await sub.exec(['python3', '-c', script, scanSubnet], {
          timeout: 45000,
        })

        if (result.exitCode !== 0) {
          throw new Error(
            result.stderr.toString().trim() ||
              'Printer discovery process failed.',
          )
        }
        return discoveredPrinterList.parse(JSON.parse(result.stdout.toString()))
      },
    )
  } catch (error) {
    throw new Error(
      'Printer search failed: ' +
        (error instanceof Error ? error.message : String(error)),
    )
  }
}
