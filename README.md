# NEO CSV Converter

A browser-based tool that converts NASA Earth Observations (NEO) gridded CSV files
into a single combined point table — ready to import into spreadsheets or ArcGIS Online.

## What it does

A NEO CSV download is a *grid*: latitude runs down the rows, longitude across the
columns, and each cell holds a measured value. This tool reshapes that grid into a
flat table with one row per data point:

| Date | latitude | longitude | value | color |
|------|----------|-----------|-------|-------|
| 05/01/2025 | 0.5 | -179.5 | 28.74 | #dda99c |

- **Date** — `MM/DD/YYYY`, read from the `YYYY-MM-DD` date in each input filename.
- **value** — the measured value. The column name is configurable (e.g. `SST`).
- **color** — a hex color (`#rrggbb`) looked up from an Adobe Color Table (`.act`) palette.
- No-data cells (value `99999`) are dropped.
- Multiple input files can be combined into one output (sorted by date), or
  converted individually and bundled into a ZIP.

## Usage

1. Open `convert.html` in a web browser (double-click it — no server or install needed).
2. **Color palette** — choose an Adobe Color Table (`.act`) file.
3. **Settings** — set the value column name and the minimum/maximum values for the
   color scale (defaults: -2 and 35, matching the included `sst_35.act` palette).
   Values are mapped linearly across the 256-color palette. Choose the **Output**
   mode: one combined CSV, or a ZIP with one converted CSV per input file.
4. **CSV files** — drop NEO CSV files onto the drop zone, or click to choose files.
5. Click **Convert & Download**.

The value column name and date range are baked into every output filename. A
combined run downloads one CSV, e.g.
`neo_converted_SST_2025-04-01_to_2026-03-01.csv`. A ZIP run downloads
`neo_converted_<value>_<range>.zip` containing one
`neo_converted_<value>_<date>.csv` per input file.

## Input format

The tool expects NEO "labeled grid" CSV files:

- The first line is a header: the literal text `lat/lon` followed by longitude values.
- Each following line starts with a latitude, followed by one value per longitude.
- No-data cells contain `99999.0`.
- The filename must contain a date in `YYYY-MM-DD` form.

## Files

- `convert.html` — the web page (UI and glue code).
- `converter.js` — the conversion logic. Must stay in the same folder as `convert.html`.
- `tests/converter.test.js` — automated tests.
- `NEO-csv-files/` — sample NEO data and a sample `sst_35.act` palette.

## Running the tests

Requires Node.js 18 or newer:

```
node --test tests/converter.test.js
```

## License

MIT — see [LICENSE](LICENSE).
