import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'
import { i18n } from '../i18n'

const { InputSpec, Value } = sdk

/**
 * Resolve a US ZIP code to its own centroid.
 *
 * Zippopotam is used rather than Open-Meteo's geocoder because the latter
 * matches a ZIP to the CITY it belongs to (60601 → central Chicago), which can
 * be many miles from the actual postal area.
 */
async function geocodeZip(
  zip: string,
): Promise<{ lat: number; lon: number; place: string } | null> {
  if (!/^\d{5}$/.test(zip)) return null
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      places?: {
        latitude?: string
        longitude?: string
        'place name'?: string
        'state abbreviation'?: string
      }[]
    }
    const place = data?.places?.[0]
    if (!place) return null
    const lat = Number(place.latitude)
    const lon = Number(place.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return {
      lat,
      lon,
      place:
        `${place['place name'] ?? ''}, ${place['state abbreviation'] ?? ''}`.replace(
          /, $/,
          '',
        ),
    }
  } catch {
    return null
  }
}

export const editLocation = sdk.Action.withInput(
  '02-edit-location',
  {
    name: i18n('Edit Location & Units'),
    description: i18n(
      'Where the frame is, for the weather forecast and radar, and how temperatures display. Weather comes from Open-Meteo (no API key needed).',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  InputSpec.of({
    name: Value.text({
      name: i18n('Location name'),
      description: i18n('Shown as a label, e.g. "Home"'),
      required: false,
      default: null,
    }),
    zip: Value.text({
      name: i18n('US ZIP code (optional)'),
      description: i18n(
        'Enter a 5-digit ZIP to set the location automatically; it replaces the coordinates below. Leave blank to keep the coordinates.',
      ),
      required: false,
      default: null,
      patterns: [
        {
          regex: '^\\d{5}$',
          description: i18n('Must be a 5-digit US ZIP code'),
        },
      ],
    }),
    latitude: Value.number({
      name: i18n('Latitude'),
      description: i18n(
        'Decimal degrees, e.g. 41.8781. Ignored when a ZIP is entered.',
      ),
      required: false,
      default: null,
      min: -90,
      max: 90,
      step: 0.0001,
      integer: false,
    }),
    longitude: Value.number({
      name: i18n('Longitude'),
      description: i18n(
        'Decimal degrees, e.g. -87.6298. Ignored when a ZIP is entered.',
      ),
      required: false,
      default: null,
      min: -180,
      max: 180,
      step: 0.0001,
      integer: false,
    }),
    timezone: Value.text({
      name: i18n('Time zone'),
      description: i18n(
        'IANA name, e.g. America/Chicago. Controls the clock, calendars and weather. Blank uses the server’s zone (normally UTC).',
      ),
      required: false,
      default: null,
    }),
    temperature: Value.select({
      name: i18n('Temperature unit'),
      default: 'fahrenheit',
      values: {
        fahrenheit: i18n('Fahrenheit (°F)'),
        celsius: i18n('Celsius (°C)'),
      },
    }),
    dimAtNight: Value.toggle({
      name: i18n('Dim the screen at night'),
      description: i18n(
        'After the frame sits idle at night, dim the dashboard instead of switching to the photo view. Photos and text stay visible; one touch wakes it.',
      ),
      default: true,
    }),
    redNight: Value.toggle({
      name: i18n('Red night colours'),
      description: i18n(
        'Tint the dimmed night screen red to remove blue light before sleep. Has no effect while the screen is awake.',
      ),
      default: false,
    }),
  }),
  // Prefill
  async ({ effects }) => {
    const cfg = await configJson.read().once()
    return {
      name: cfg?.location?.name ?? 'Home',
      zip: cfg?.location?.zip ?? '',
      latitude: cfg?.location?.lat ?? null,
      longitude: cfg?.location?.lon ?? null,
      timezone: cfg?.timezone ?? '',
      temperature: cfg?.units?.temperature ?? 'fahrenheit',
      dimAtNight: cfg?.night?.dim ?? true,
      redNight: cfg?.night?.red ?? false,
    }
  },
  // Handler
  async ({ effects, input }) => {
    const zip = (input.zip || '').trim()
    const lat = input.latitude
    const lon = input.longitude
    const hasCoords =
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      // 0,0 is the null island: the sync service treats it as "no location"
      // and skips weather entirely, so never save it as a real coordinate.
      !(lat === 0 && lon === 0)

    if (!zip && !hasCoords) {
      return {
        version: '1',
        title: 'Location needed',
        result: null,
        message:
          'Enter a 5-digit US ZIP code, or a latitude and longitude. The weather forecast and radar need a location.',
      }
    }

    let resolved = null
    if (zip) {
      resolved = await geocodeZip(zip)
      if (!resolved) {
        return {
          version: '1',
          title: 'ZIP code not found',
          result: null,
          message: `Could not look up ZIP ${zip}. Check the code, or enter latitude and longitude instead.`,
        }
      }
    }

    const finalLat = resolved ? resolved.lat : (lat as number)
    const finalLon = resolved ? resolved.lon : (lon as number)
    await configJson.merge(effects, {
      location: {
        name: (input.name || (resolved ? resolved.place : 'Home')).trim(),
        lat: finalLat,
        lon: finalLon,
        zip: resolved ? zip : '',
      },
      timezone: (input.timezone || '').trim(),
      units: { temperature: input.temperature },
      night: { dim: !!input.dimAtNight, red: !!input.redNight },
    })
    return {
      version: '1',
      title: 'Location & units saved',
      result: null,
      message: resolved
        ? `Location set from ZIP ${zip}: ${resolved.place} (${finalLat.toFixed(4)}, ${finalLon.toFixed(4)}). Clock, calendar, weather and night display settings apply after the next sync cycle, or run **Sync Now**.`
        : 'Clock, calendar, weather and night display settings apply after the next sync cycle, or run **Sync Now**.',
    }
  },
)
