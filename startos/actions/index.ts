import { sdk } from '../sdk'
import { editPhotos } from './editPhotos'
import { editCalendars } from './editCalendars'
import { editLocation } from './editLocation'
import { editSidebar } from './editSidebar'
import { editUsers } from './editUsers'
import { editChores } from './editChores'
import { editShopping } from './editShopping'
import { editPrinter } from './editPrinter'
import { editVestaboard } from './editVestaboard'
import { syncNow } from './syncNow'
import { photoAlbumInfo } from './photoAlbumInfo'

// StartOS stores actions in a BTreeMap keyed by action id and renders them in
// id order (the Actions page also sorts by `id.localeCompare`), so the numeric
// prefixes in each action's id — not this registration order — decide what the
// user sees. Keep both in the same order.
export const actions = sdk.Actions.of()
  .addAction(syncNow)
  .addAction(editLocation)
  .addAction(editCalendars)
  .addAction(editUsers)
  .addAction(editPhotos)
  .addAction(photoAlbumInfo)
  .addAction(editSidebar)
  .addAction(editShopping)
  .addAction(editChores)
  .addAction(editPrinter)
  .addAction(editVestaboard)
