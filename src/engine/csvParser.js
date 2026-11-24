/**
 * csvParser.js
 *
 * Converts raw CSV text into the typed objects the discount engine expects.
 * Uses papaparse for reliable CSV parsing, then maps column names to the
 * internal data shapes.
 *
 * Expected rules.csv columns:
 *   rule_id, scope, applies_to, type, value, stackable
 *
 * Expected cart.csv columns:
 *   item_id, product, brand, platform, base_price
 */

import Papa from 'papaparse'

/**
 * Parses the raw text of rules.csv into an array of DiscountRule objects.
 * Returns { data, errors } where errors is an array of row-level issues.
 */

export function parseRulesCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return { data: [], errors: parseErrors.map((e) => e.message) }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const missing = []

    if (!row.rule_id) missing.push('rule_id')
    if (!row.scope) missing.push('scope')
    if (!row.type) missing.push('type')
    if (row.value === undefined || row.value === '') missing.push('value')
    if (row.stackable === undefined || row.stackable === '') missing.push('stackable')

    const scope = (row.scope || '').trim().toLowerCase()

    // applies_to is required for brand and platform rules,
    // but not for cart rules.
    if (scope !== 'cart' && !row.applies_to) {
      missing.push('applies_to')
    }

    if (scope === 'cart' &&
        (row.min_cart_value === undefined || row.min_cart_value === '')) {
      missing.push('min_cart_value')
    }

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields — ${missing.join(', ')}`)
      return
    }

    // Validate scope
    if (!['brand', 'platform', 'cart'].includes(scope)) {
      errors.push(`Row ${rowNum}: invalid scope "${row.scope}"`)
      return
    }

    // Validate discount type
    const type = row.type.trim().toLowerCase()

    if (type !== 'percentage' && type !== 'flat') {
      errors.push(`Row ${rowNum}: invalid type "${row.type}"`)
      return
    }

    // Validate discount value
    const value = Number(row.value)

    if (!Number.isFinite(value) || value <= 0) {
      errors.push(`Row ${rowNum}: value must be a positive number`)
      return
    }

    // Validate cart minimum value
    let minCartValue = null

    if (scope === 'cart') {
      minCartValue = Number(row.min_cart_value)

      if (!Number.isFinite(minCartValue) || minCartValue < 0) {
        errors.push(`Row ${rowNum}: min_cart_value must be a non-negative number`)
        return
      }

      if (type !== 'percentage') {
        errors.push(`Row ${rowNum}: cart discounts must be percentage-based`)
        return
      }
    }

    const stackableStr = row.stackable.trim().toLowerCase()
    const stackable = ['true', '1', 'yes'].includes(stackableStr)

    data.push({
      ruleId: row.rule_id.trim(),
      scope,
      appliesTo: (row.applies_to || '').trim(),
      type,
      value,
      stackable,
      minCartValue,
    })
  })

  return { data, errors }
}


/**
 * Parses the raw text of cart.csv into an array of CartItem objects.
 * Returns { data, errors } where errors is an array of row-level issues.
 */
export function parseCartCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return { data: [], errors: parseErrors.map((e) => e.message) }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const missing = []

    if (!row.item_id) missing.push('item_id')
    if (!row.product) missing.push('product')
    if (!row.brand) missing.push('brand')
    if (!row.platform) missing.push('platform')
    if (row.base_price === undefined || row.base_price === '') missing.push('base_price')

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields — ${missing.join(', ')}`)
      return
    }

    const basePrice = parseFloat(row.base_price)
    if (isNaN(basePrice) || basePrice <= 0) {
      errors.push(`Row ${rowNum}: base_price must be a positive number, got "${row.base_price}"`)
      return
    }

    data.push({
      itemId: row.item_id.trim(),
      product: row.product.trim(),
      brand: row.brand.trim(),
      platform: row.platform.trim(),
      basePrice: Math.round(basePrice),
    })
  })

  return { data, errors }
}
