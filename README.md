# Opptra Discount Engine

A React-based discount engine built for the Opptra FDE Intern assignment.

## Features

- Product-level discounts based on brand and platform.
- Cart-level discounts with minimum cart value conditions.
- Natural-language discount rule creation using Groq AI.
- Rule preview, confirmation, and discard.
- PDF cart upload and automatic discount recalculation.
- Item-level and cart-level discount breakdown.

## Tech Stack

React, Vite, JavaScript, Node.js, Express, Groq API, PDF.js.

## Live Deployment

**Live Application:** https://discount-engine-assignment-nlug.onrender.com

**GitHub Repository:** https://github.com/Nithinkumar03/discount-engine-assignment

## Run Locally

**Step 1 — Install dependencies and configure the API key**

```bash
npm install
```

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
```

**Step 2 — Start the application**

Open two terminals in the project folder.

Terminal 1:

```bash
node server/index.js
```

Terminal 2:

```bash
npm run dev
```

Open http://localhost:5173.

## Sample Data

- `sample-data/rules.csv` — discount rules.
- `sample-data/cart.csv` — cart items.
- `sample-data/cart less 4000.csv` — cart below the minimum cart value.

## Discount Logic

- The largest saving among matching non-stackable item rules is selected.
- Stackable item rules are applied after the winning non-stackable rule.
- Cart-level discounts are calculated after item-level discounts.
- Minimum cart value conditions are checked before applying cart offers.

## Production Build

```bash
npm run build
```

The frontend production files are generated in `dist/`.
