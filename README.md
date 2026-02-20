# Masters of Horror — Card Database

A gothic-styled web application for browsing, analyzing, and comparing card data for the Masters of Horror card game. Pulls live data from Google Sheets.

## Features

- **Dashboard** — Overview stats, cost curves, rarity distributions, Might vs Will scatter plots
- **Card Browser** — Filterable grid/list with search by name, type, rarity, author, cost range, keywords
- **Decks & Authors** — Cards grouped by author with composition breakdowns and average stats
- **Keyword Reference** — Glossary of all game mechanics (Evermore, Foreshadow, Awaken, Martyr, Tear, etc.)
- **Card Comparison** — Side-by-side comparison of up to 4 cards with stat differential highlighting
- **Export** — CSV and JSON export of filtered card data
- **Live Sync** — Fetches directly from Google Sheets with caching

## Setup

### 1. Make the Google Sheet Public

The spreadsheet must be shared with "Anyone with the link can view":

1. Open the Google Sheet
2. Click **Share** > **General access** > **Anyone with the link**
3. Set permission to **Viewer**

### 2. Serve the Website

This is a zero-build static site. Serve it with any static file server:

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### 3. Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:YOUR_USERNAME/moh-card-db.git
git push -u origin main
```

Then in GitHub repo Settings > Pages > Source: Deploy from branch `main`, folder `/ (root)`.

## Spreadsheet Column Format

The app expects columns in this order (matching the MOH spreadsheet):

| Column | Field | Example |
|--------|-------|---------|
| 1 | Card ID | MOH1-78 |
| 2 | Deck Name | Trapped |
| 3 | Card Name | Van Helsing's Journal |
| 4 | Card Type | Narrative |
| 5 | Rarity | Common (C) |
| 6 | Inspiration Cost | 2 |
| 7 | Might | — |
| 8 | Will | — |
| 9 | Effect Text | "Target 1 Character..." |
| 10+ | Keywords, Literary Acclaim, etc. (optional) |

The parser also supports header-based column detection, so labeled columns will be mapped automatically.

## Tech Stack

- Vanilla HTML / CSS / JavaScript (ES modules)
- Chart.js 4.x (CDN) for analytics visualizations
- Google Sheets Visualization API (no API key required)
- Google Fonts: Cinzel, Crimson Text, Fira Code

## Customization

### Changing the Spreadsheet

Edit the `SPREADSHEET_ID` constant in `js/api.js`:

```javascript
const SPREADSHEET_ID = 'your-spreadsheet-id-here';
```

### Adding Keywords

Add keyword definitions in `js/api.js` in the `KEYWORD_DEFINITIONS` object:

```javascript
'NewKeyword': {
  name: 'NewKeyword',
  description: 'What this keyword does in plain English.',
  mechanic: 'Technical mechanic description'
}
```

## License

Internal tool for the Masters of Horror development team.
