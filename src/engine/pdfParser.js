
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url'

function splitCSVLine(line) {
  const values = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

/**
 * Extracts cart items from a PDF table.
 * Expected columns: Product, Brand, Platform, Base Price.
 *
 * Returns { data, errors }, matching parseCartCSV().
 */
export async function parseCartPDF(file) {
  try {
    const buffer = await file.arrayBuffer()

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    }).promise

    const allLines = []

    // Read text from every PDF page.
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()

      const items = content.items
        .filter((item) => item.str && item.str.trim())
        .map((item) => ({
          text: item.str.trim(),
          x: item.transform[4],
          y: item.transform[5],
        }))

      // Group text items that share approximately the same vertical position.
      const lines = []

      items.forEach((item) => {
        let line = lines.find((entry) => Math.abs(entry.y - item.y) < 3)

        if (!line) {
          line = { y: item.y, items: [] }
          lines.push(line)
        }

        line.items.push(item)
      })

      lines.forEach((line) => {
        line.items.sort((a, b) => a.x - b.x)
      })

      allLines.push(...lines)
    }
// First, check whether the PDF contains CSV-style text.
const textLines = allLines
  .map((line) => line.items.map((item) => item.text).join(' ').trim())
  .filter(Boolean)

const csvHeaderIndex = textLines.findIndex((line) => {
  const normalized = line.toLowerCase().replace(/\s+/g, '')

  return (
    normalized.includes('product') &&
    normalized.includes('brand') &&
    normalized.includes('platform') &&
    normalized.includes('base_price')
  )
})

if (csvHeaderIndex !== -1) {
  const headers = splitCSVLine(textLines[csvHeaderIndex])
    .map((header) => header.toLowerCase().replace(/[\s_]/g, ''))

  const productIndex = headers.indexOf('product')
  const brandIndex = headers.indexOf('brand')
  const platformIndex = headers.indexOf('platform')
  const priceIndex = headers.indexOf('baseprice')
  const itemIdIndex = headers.indexOf('itemid')

  const data = []
  const errors = []

  for (const line of textLines.slice(csvHeaderIndex + 1)) {
    const columns = splitCSVLine(line)

    if (columns.every((value) => !value)) continue

    const product = columns[productIndex] || ''
    const brand = columns[brandIndex] || ''
    const platform = columns[platformIndex] || ''
    const priceText = columns[priceIndex] || ''

    const rowNumber = data.length + errors.length + 1
    const basePrice = Number(priceText.replace(/,/g, '').replace(/[^\d.]/g, ''))

    if (
      !product ||
      !brand ||
      !platform ||
      !priceText ||
      !Number.isFinite(basePrice) ||
      basePrice <= 0
    ) {
      errors.push(`PDF row ${rowNumber}: invalid or incomplete cart item.`)
      continue
    }

    data.push({
      itemId: columns[itemIdIndex] || `PDF-${String(data.length + 1).padStart(3, '0')}`,
      product,
      brand,
      platform,
      basePrice: Math.round(basePrice),
    })
  }

  if (data.length === 0) {
    errors.push('No valid cart items were found in the PDF.')
  }

  return { data, errors }
}
    // Find the table header.
    const header = allLines.find((line) => {
      const text = line.items.map((item) => item.text).join(' ').toLowerCase()

      return (
        text.includes('product') &&
        text.includes('brand') &&
        text.includes('platform') &&
        text.includes('base') &&
        text.includes('price')
      )
    })

    if (!header) {
      return {
        data: [],
        errors: ['Could not find the expected PDF table headers: Product, Brand, Platform, Base Price.'],
      }
    }

    // Find the horizontal positions of the four column headings.
    const findHeaderX = (words) => {
      const item = header.items.find((entry) =>
        words.includes(entry.text.toLowerCase())
      )

      return item ? item.x : null
    }

    const productX = findHeaderX(['product'])
    const brandX = findHeaderX(['brand'])
    const platformX = findHeaderX(['platform'])

    const baseItem = header.items.find((entry) =>
      entry.text.toLowerCase().includes('base')
    )

    const basePriceX = baseItem ? baseItem.x : null

    const headerPositions = [productX, brandX, platformX, basePriceX]

    if (headerPositions.some((position) => position === null)) {
      return {
        data: [],
        errors: ['Could not identify all four PDF table columns.'],
      }
    }

    // Use the midpoint between headings as the column boundaries.
    const boundaries = [
      (productX + brandX) / 2,
      (brandX + platformX) / 2,
      (platformX + basePriceX) / 2,
    ]

    const data = []
    const errors = []

    // Process lines below the header.
    const dataLines = allLines.filter((line) => line.y < header.y)

    dataLines.forEach((line) => {
      const columns = ['', '', '', '']

      line.items.forEach((item) => {
        let column = 0

        if (item.x >= boundaries[2]) {
          column = 3
        } else if (item.x >= boundaries[1]) {
          column = 2
        } else if (item.x >= boundaries[0]) {
          column = 1
        }

        columns[column] += (columns[column] ? ' ' : '') + item.text
      })

      const [product, brand, platform, priceText] =
        columns.map((value) => value.trim())

      // Ignore unrelated lines outside the cart table.
      if (!product && !brand && !platform && !priceText) return

      // Ignore lines that contain no likely product information.
      if (!product && !brand && !platform) return

      const rowNumber = data.length + errors.length + 1

      if (!product || !brand || !platform || !priceText) {
        errors.push(`PDF row ${rowNumber}: missing product, brand, platform, or base price.`)
        return
      }

      const priceMatch = priceText.replace(/,/g, '').match(/\d+(?:\.\d+)?/)

      if (!priceMatch) {
        errors.push(`PDF row ${rowNumber}: invalid base price "${priceText}".`)
        return
      }

      const basePrice = Number(priceMatch[0])

      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        errors.push(`PDF row ${rowNumber}: base price must be positive.`)
        return
      }

      data.push({
        itemId: `PDF-${String(data.length + 1).padStart(3, '0')}`,
        product,
        brand,
        platform,
        basePrice: Math.round(basePrice),
      })
    })

    if (data.length === 0) {
      errors.push('No valid cart items were found in the PDF.')
    }

    return { data, errors }
  } catch (error) {
    console.error('PDF parsing error:', error)

    return {
      data: [],
      errors: ['Unable to read this PDF. Please upload a valid PDF containing a cart table.'],
    }
  }
}
