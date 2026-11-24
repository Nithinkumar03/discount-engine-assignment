/**
 * App.jsx
 *
 * Top-level component. Manages state for rules, cart items, and results.
 * Wires together CSV upload → parse → engine → display.
 */

import { useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import { parseRulesCSV, parseCartCSV } from './engine/csvParser.js'
import { parseCartPDF } from './engine/pdfParser.js'
import {
  processCart,
  calculateCartDiscount
} from './engine/discountEngine.js'

// ── Column definitions ───────────────────────────────────────────

const RULES_COLUMNS = [
  { key: 'ruleId',    label: 'Rule ID' },
  { key: 'scope',     label: 'Scope',      render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  { key: 'appliesTo', label: 'Applies To' },
  { key: 'type',      label: 'Type',       render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  {
    key: 'value',
    label: 'Value',
    render: (v, row) => row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`,
  },
  { key: 'stackable', label: 'Stackable',  render: (v) => (v ? 'Yes' : 'No') },
]

const CART_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'brand',     label: 'Brand' },
  { key: 'platform',  label: 'Platform' },
  { key: 'basePrice', label: 'Base Price', render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
]

const RESULTS_COLUMNS = [
  { key: 'itemId',    label: 'Item' },
  { key: 'product',   label: 'Product' },
  { key: 'basePrice', label: 'Base Price',  render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
  { key: 'finalPrice',label: 'Final Price',
    render: (v, row) => (
      <span style={{ fontWeight: 700, color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48' }}>
        Rs.{v.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'totalDiscount',
    label: 'You Save',
    render: (v) =>
      v > 0 ? (
        <span style={{ color: '#1e5c2c', fontWeight: 600 }}>Rs.{v.toLocaleString('en-IN')}</span>
      ) : (
        <span style={{ color: '#888' }}>—</span>
      ),
  },
  {
    key: 'reasoning',
    label: 'Offer Applied',
    render: (v) => (
      <span style={{ color: v === 'No offers available' ? '#888' : '#131A48', fontStyle: v === 'No offers available' ? 'italic' : 'normal' }}>
        {v}
      </span>
    ),
  },
]

// ── Styles ───────────────────────────────────────────────────────

const S = {
  page:    { minHeight: '100vh', background: '#f7f7f9', fontFamily: 'Arial, sans-serif' },
  header:  { background: '#131A48', padding: '0.85rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logoTxt: { fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' },
  logoSpan:{ color: '#FF5800' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  main:    { maxWidth: 960, margin: '0 auto', padding: '1.8rem 1.5rem' },
  section: { background: '#fff', border: '1px solid #CECECE', borderRadius: 6, padding: '1.2rem 1.4rem', marginBottom: '1.2rem' },
  sectionTitle: { fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: '#131A48', marginBottom: '0.7rem', paddingBottom: 6, borderBottom: '2px solid #FF5800', display: 'inline-block' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  btn:     {
    background: '#FF5800', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  totalRow: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem',
    borderTop: '2px solid #131A48',
  },
  totalLabel: { fontWeight: 700, fontSize: 14, color: '#131A48' },
  totalValue: { fontWeight: 700, fontSize: 16, color: '#131A48' },
  tag: (color, bg) => ({
    display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px',
    borderRadius: 20, background: bg, color, textTransform: 'uppercase', letterSpacing: '0.04em',
  }),
}

// ── Component ────────────────────────────────────────────────────

export default function App() {
  const [rules, setRules]           = useState([])
  const [rulesErrors, setRulesErr]  = useState([])
  const [rulesFileName, setRulesFileName] = useState('')

  const [cartItems, setCartItems]   = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartFileName, setCartFileName]   = useState('')

  const [results, setResults]       = useState(null)
  const [cartDiscountResult, setCartDiscountResult] = useState(null)
    // Natural-language discount rule state
  const [naturalRuleText, setNaturalRuleText] = useState('')
  const [parsedRule, setParsedRule] = useState(null)
  const [ruleParseError, setRuleParseError] = useState('')
  const [isParsingRule, setIsParsingRule] = useState(false)

  // ── Handlers ──

  function handleRulesLoad(csvText, fileName) {
    const { data, errors } = parseRulesCSV(csvText)
    setRules(data)
    setRulesErr(errors)
    setRulesFileName(fileName)
    setResults(null) 
    setCartDiscountResult(null)// clear stale results
  }

  function handleCartLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
    setCartItems(data)
    setCartErrors(errors)
    setCartFileName(fileName)
    setResults(null)
    setCartDiscountResult(null)
  }

  async function handleCartPDFLoad(event) {
    const file = event.target.files[0]
    if (!file) return

    try {
      if (file.type !== 'application/pdf') {
        setCartErrors(['Please upload a valid PDF file.'])
        return
      }

      const { data, errors } = await parseCartPDF(file)

      setCartErrors(errors)

      // Replace the cart only if at least one valid item was found.
      if (data.length > 0) {
        setCartItems(data)
        setCartFileName(file.name)

        // Automatically recalculate using the active rules.
        if (rules.length > 0) {
          const updatedResults = processCart(data, rules)
          setResults(updatedResults)
          setCartDiscountResult(
            calculateCartDiscount(updatedResults, rules)
          )
        } else {
          setResults(null)
          setCartDiscountResult(null)
        }
      }
    } catch (error) {
      setCartErrors(['Unable to process the PDF. Please try another file.'])
    } finally {
      event.target.value = ''
    }
  }

  
function handleCalculate() {
  // Calculate discounts for individual products
  const res = processCart(cartItems, rules)

  // Calculate the additional cart-level discount
  const cartDiscount = calculateCartDiscount(res, rules)

  // Save both results
  setResults(res)
  setCartDiscountResult(cartDiscount)
}

 
async function handleParseRule() {
  setIsParsingRule(true)
  setRuleParseError('')
  setParsedRule(null)

  try {
    const response = await fetch('/api/parse-rule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: naturalRuleText }),
    })

    const responseText = await response.text()

    if (!responseText.trim()) {
      throw new Error(
        `Backend returned an empty response (HTTP ${response.status}). Check whether the backend server is running.`
      )
    }

    let data

    try {
      data = JSON.parse(responseText)
    } catch {
      throw new Error(
        `Backend returned an invalid response (HTTP ${response.status}). Check the backend terminal for errors.`
      )
    }

    if (!response.ok) {
      throw new Error(data.error || 'Unable to parse the rule.')
    }

    setParsedRule(data)
  } catch (error) {
    setRuleParseError(error.message)
  } finally {
    setIsParsingRule(false)
  }
}


  function handleConfirmRule() {
    if (!parsedRule || !parsedRule.isResolvable) return

    const newRule = {
      ruleId: `CUSTOM-${Date.now()}`,
      scope: parsedRule.scope,
      appliesTo: parsedRule.scope === 'cart' ? '' : parsedRule.appliesTo,
      type: parsedRule.type,
      value: Number(parsedRule.value),
      stackable: parsedRule.stackable,
      minCartValue:
        parsedRule.scope === 'cart'
          ? Number(parsedRule.minCartValue)
          : null,
    }

    const updatedRules = [...rules, newRule]
    setRules(updatedRules)

    // Recalculate the current cart using the updated rules.
    if (cartItems.length > 0) {
      const updatedResults = processCart(cartItems, updatedRules)
      setResults(updatedResults)
      setCartDiscountResult(
        calculateCartDiscount(updatedResults, updatedRules)
      )
    }

    setParsedRule(null)
    setNaturalRuleText('')
    setRuleParseError('')
  }

  function handleDiscardRule() {
    setParsedRule(null)
    setRuleParseError('')
  }

  const canCalculate = rules.length > 0 && cartItems.length > 0

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logoTxt}>O<span style={S.logoSpan}>pp</span>tra</div>
        <div style={S.headerSub}>Discount Engine</div>
      </div>

      <div style={S.main}>

        {/* Upload row */}
        <div style={S.grid2}>
          {/* Rules upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Discount Rules</div>
            <CsvUploader
              label="rules.csv"
              description="Upload your discount rules CSV"
              onLoad={handleRulesLoad}
              hasData={rules.length > 0}
              fileName={rulesFileName}
            />
            <ErrorBanner errors={rulesErrors} />
            {rules.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {rules.length} rule{rules.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={RULES_COLUMNS} rows={rules} />
              </div>
            )}
          </div>

          {/* Cart upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Items</div>
            <CsvUploader
              label="cart.csv"
              description="Upload your cart CSV"
              onLoad={handleCartLoad}
              hasData={cartItems.length > 0}
              fileName={cartFileName}
            />

            <div style={{ marginTop: 12 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#131A48',
                  marginBottom: 6,
                }}
              >
                Or upload cart as PDF
              </label>

              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleCartPDFLoad}
                style={{ fontSize: 12 }}
              />
            </div>

            <ErrorBanner errors={cartErrors} />
            {cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={CART_COLUMNS} rows={cartItems} />
              </div>
            )}
          </div>
        </div>


        {/* Natural language discount rule */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Create Discount Using Natural Language</div>

          <textarea
            value={naturalRuleText}
            onChange={(e) => setNaturalRuleText(e.target.value)}
            placeholder="Example: 20% off for Natura Casa brand, stackable with other offers"
            rows={3}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #CECECE',
              borderRadius: 4,
              fontSize: 13,
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'Arial, sans-serif',
            }}
          />

          <button
            style={
              naturalRuleText.trim() && !isParsingRule
                ? S.btn
                : S.btnDisabled
            }
            onClick={handleParseRule}
            disabled={!naturalRuleText.trim() || isParsingRule}
          >
            {isParsingRule ? 'Parsing...' : 'Parse Discount Rule'}
          </button>

          {ruleParseError && (
            <div style={{ color: '#b00020', marginTop: 10, fontSize: 13 }}>
              {ruleParseError}
            </div>
          )}

          {parsedRule && !parsedRule.isResolvable && (
            <div style={{ color: '#b00020', marginTop: 10, fontSize: 13 }}>
              {parsedRule.clarification || 'Please provide more details.'}
            </div>
          )}

          
{parsedRule && parsedRule.isResolvable && (
  <div>
    <div style={{
      marginTop: 15,
      padding: 12,
      background: '#f7f7f9',
      borderRadius: 4
    }}>
      <strong>Parsed Rule — Please Review</strong>
      <p>Scope: {parsedRule.scope}</p>
      <p>Applies To: {parsedRule.appliesTo || 'Entire Cart'}</p>
      <p>Discount Type: {parsedRule.type}</p>
      <p>Discount Value: {parsedRule.value}</p>
      <p>Stackable: {parsedRule.stackable ? 'Yes' : 'No'}</p>

      {parsedRule.scope === 'cart' && (
        <p>Minimum Cart Value: Rs.{parsedRule.minCartValue}</p>
      )}
    </div>

    <div style={{
      display: 'flex',
      gap: '10px',
      marginTop: 12
    }}>
      <button
        style={S.btn}
        onClick={handleConfirmRule}
      >
        Confirm Rule
      </button>

      <button
        style={{ ...S.btn, background: '#777' }}
        onClick={handleDiscardRule}
      >
        Discard Rule
      </button>
    </div>
  </div>
)}


               <div style={{ display: 'flex', gap: '10px', marginTop: 12 }}>
                
              </div>

        </div>

        {/* Calculate button */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button
            style={canCalculate ? S.btn : S.btnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            Calculate Discounts
          </button>
          {!canCalculate && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Upload both files to calculate
            </div>
          )}
        </div>

       
{/* Results */}
{results && cartDiscountResult && (
  <div style={S.section}>
    <div style={S.sectionTitle}>Cart Summary</div>

    <DataTable columns={RESULTS_COLUMNS} rows={results} />

    {/* Cart subtotal after item discounts */}
    <div style={S.totalRow}>
      <span style={S.totalLabel}>Cart Total Before Offer</span>
      <span style={S.totalValue}>
        Rs.{cartDiscountResult.subtotal.toLocaleString('en-IN')}
      </span>
    </div>

    {/* Show cart discount only when applied */}
    {cartDiscountResult.applied && (
      <div style={{
        ...S.totalRow,
        borderTop: 'none',
        marginTop: '0.3rem',
        paddingTop: '0.3rem'
      }}>
        <span style={{ ...S.totalLabel, color: '#1e5c2c' }}>
          {cartDiscountResult.reasoning}
        </span>
        <span style={{ ...S.totalValue, color: '#1e5c2c' }}>
          -Rs.{cartDiscountResult.discount.toLocaleString('en-IN')}
        </span>
      </div>
    )}

    {/* Final payable amount */}
    <div style={{
      ...S.totalRow,
      borderTop: '2px solid #131A48'
    }}>
      <span style={S.totalLabel}>Final Cart Total</span>
      <span style={S.totalValue}>
        Rs.{cartDiscountResult.finalTotal.toLocaleString('en-IN')}
      </span>
    </div>
  </div>
)}
    </div>
    </div>
  )
}
