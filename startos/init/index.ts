import { sdk } from '../sdk'
import { dependencies } from '../dependencies'
import { setInterfaces } from '../interfaces'
import { versionGraph } from '../versions'
import { actions } from '../actions'
import { restoreInit } from '../backups'
import { initializeChores, initializeShoppingDefaults } from '../utils'

const installDefaults = sdk.setupOnInit(async (effects, kind) => {
  if (kind !== 'install') return
  await initializeShoppingDefaults(effects)
  await initializeChores(effects)
})

export const init = sdk.setupInit(
  restoreInit,
  versionGraph,
  installDefaults,
  setInterfaces,
  actions,
  dependencies,
)

export const uninit = sdk.setupUninit(versionGraph)
