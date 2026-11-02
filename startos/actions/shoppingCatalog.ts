// Convert the category-based editor to the flat catalogs consumed by the frame.
export type CatalogItem = {
  name: string
  category: string
  store: string
  usual: boolean
}

type Catalog = { categories: string[]; items: CatalogItem[] }

export type ShoppingConfig = Catalog & {
  stores: { name: string }[]
  defaults?: Catalog & { enabled: boolean }
}

export type CategoryRow = {
  name: string
  items: { name: string; store: string; usual: boolean }[]
}

export type ShoppingEditor = {
  stores: string[]
  useDefaults: boolean
  defaultCategories: CategoryRow[]
  categories: CategoryRow[]
}

// Fresh rows on every call: editing/removing a starter must never mutate the
// template or cause a saved removal to be filled back in on the next open.
function starterCategories(): CategoryRow[] {
  const groups: [string, string[]][] = [
    [
      'Produce',
      [
        'Apples',
        'Bananas',
        'Oranges',
        'Lettuce',
        'Tomatoes',
        'Onions',
        'Potatoes',
        'Carrots',
      ],
    ],
    ['Dairy & Eggs', ['Milk', 'Eggs', 'Butter', 'Cheese', 'Yogurt']],
    ['Bakery', ['Bread', 'Bagels', 'Tortillas']],
    ['Meat & Fish', ['Chicken', 'Ground beef', 'Fish']],
    [
      'Pantry',
      [
        'Rice',
        'Pasta',
        'Pasta sauce',
        'Cereal',
        'Oatmeal',
        'Flour',
        'Sugar',
        'Olive oil',
      ],
    ],
    ['Frozen', ['Frozen vegetables', 'Frozen fruit', 'Ice cream']],
    ['Snacks', ['Crackers', 'Chips', 'Nuts']],
    ['Beverages', ['Coffee', 'Tea', 'Juice', 'Sparkling water']],
    [
      'Household',
      [
        'Paper towels',
        'Toilet paper',
        'Dish soap',
        'Laundry detergent',
        'Trash bags',
      ],
    ],
  ]
  return groups.map(([name, items]) => ({
    name,
    items: items.map((name) => ({
      name,
      store: 'none',
      usual: ['Milk', 'Eggs', 'Bread', 'Bananas'].includes(name),
    })),
  }))
}

function uniqueNames(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
}

export function storeOptions(
  stores: readonly string[],
): Record<string, string> {
  return Object.fromEntries([
    ['none', 'Unspecified'],
    ...uniqueNames(stores).map((name) => [`store:${name}`, name]),
  ])
}

function categoryRows(catalog: Catalog): CategoryRow[] {
  const categories = uniqueNames(catalog.categories).map((name) => ({
    name,
    items: [] as CategoryRow['items'],
  }))
  for (const item of catalog.items) {
    const name = item.category.trim() || 'Other'
    let category = categories.find((row) => row.name === name)
    if (!category) {
      category = { name, items: [] }
      categories.push(category)
    }
    category.items.push({
      name: item.name,
      store: item.store ? `store:${item.store}` : 'none',
      usual: item.usual,
    })
  }
  return categories
}

export function catalogToEditor(shopping: ShoppingConfig): ShoppingEditor {
  return {
    stores: uniqueNames([
      ...shopping.stores.map((store) => store.name),
      ...shopping.items.map((item) => item.store),
      ...(shopping.defaults?.items || []).map((item) => item.store),
    ]),
    // On by default; an explicitly saved off choice remains off.
    useDefaults: shopping.defaults?.enabled ?? true,
    defaultCategories: shopping.defaults
      ? categoryRows(shopping.defaults)
      : starterCategories(),
    categories: categoryRows(shopping),
  }
}

function flattenCategories(
  rows: CategoryRow[],
  options: Record<string, string>,
): Catalog {
  const categories = uniqueNames(rows.map((row) => row.name))
  const items: CatalogItem[] = []
  for (const category of rows) {
    const name = category.name.trim()
    if (!name) continue
    for (const item of category.items) {
      if (!item.name.trim()) continue
      items.push({
        name: item.name.trim(),
        category: name,
        store:
          item.store !== 'none' && Object.hasOwn(options, item.store)
            ? options[item.store]
            : '',
        usual: item.usual === true,
      })
    }
  }
  return { categories, items }
}

export function editorToCatalog(editor: ShoppingEditor): ShoppingConfig {
  const stores = uniqueNames(editor.stores)
  const options = storeOptions(stores)
  return {
    stores: stores.map((name) => ({ name })),
    ...flattenCategories(editor.categories, options),
    defaults: {
      enabled: editor.useDefaults,
      ...flattenCategories(editor.defaultCategories, options),
    },
  }
}
