import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'
import {
  catalogToEditor,
  editorToCatalog,
  storeOptions,
} from './shoppingCatalog'

const { InputSpec, Value, List } = sdk

export const editShopping = sdk.Action.withInput(
  '08-edit-shopping',
  {
    name: 'Edit Groceries',
    description:
      'Add categories, then add individual items inside each category. Choose an optional store and mark usual items for quick picks. Your current grocery list is not changed.',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  async () => {
    const cfg = await configJson.read().once()
    const editor = catalogToEditor(
      cfg?.shopping || { stores: [], categories: [], items: [] },
    )
    const itemSpec = InputSpec.of({
      name: Value.text({
        name: 'Item name',
        required: true,
        default: null,
      }),
      store: Value.select({
        name: 'Store (optional)',
        description:
          'Unspecified means no assigned store. On the frame, new additions use the store tab you tap, starting with Unspecified; this catalog setting does not override that selection.',
        default: 'none',
        values: storeOptions(editor.stores),
      }),
      usual: Value.toggle({
        name: 'Usual item',
        description: 'Show this item among the quick-pick tiles on the frame.',
        default: false,
      }),
    })
    const categorySpec = InputSpec.of({
      name: Value.text({
        name: 'Category name',
        required: true,
        default: null,
      }),
      items: Value.list(
        List.obj(
          {
            name: 'Items',
            description:
              'Add, edit, or remove items belonging to this category.',
          },
          { spec: itemSpec, displayAs: '{{name}}', uniqueBy: 'name' },
        ),
      ),
    })
    const categoryList = (name: string, description: string) =>
      Value.list(
        List.obj(
          { name, description },
          {
            displayAs: '{{name}}',
            uniqueBy: 'name',
            spec: categorySpec,
          },
        ),
      )
    return InputSpec.of({
      useDefaults: Value.toggle({
        name: 'Use prepopulated defaults',
        description:
          'Include the editable starter categories below on the frame. Turning this off keeps your starter edits saved and leaves your own categories and current grocery list unchanged.',
        default: true,
      }),
      stores: Value.list(
        List.text(
          {
            name: 'Stores',
            description:
              'Add one store per row. To use a newly added store in an item dropdown, save and reopen Edit Groceries first.',
            default: [],
          },
          { placeholder: 'Store name', minLength: 1 },
        ),
      ),
      defaultCategories: categoryList(
        'Prepopulated categories (editable)',
        'Common groceries to get started. Rename, add, or remove any category or item. Saved removals stay removed. These rows are included only when Use prepopulated defaults is on.',
      ),
      categories: categoryList(
        'Your categories',
        'Your own categories and items, always included whether defaults are on or off. If an item also exists in the starter rows, your own version takes precedence.',
      ),
    })
  },
  async () => {
    const cfg = await configJson.read().once()
    return catalogToEditor(
      cfg?.shopping || { stores: [], categories: [], items: [] },
    )
  },
  async ({ effects, input }) => {
    await configJson.merge(effects, {
      shopping: editorToCatalog(input),
    })
    return {
      version: '1',
      title: 'Groceries updated',
      result: null,
      message:
        'Categories and items saved. The frame applies them on its next one-minute refresh; the current list is unchanged. Reopen Edit Groceries to select newly added stores.',
    }
  },
)
