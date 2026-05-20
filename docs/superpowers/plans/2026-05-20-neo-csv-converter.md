# NEO CSV Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based tool that converts a batch of NASA Earth Observations (NEO) grid CSVs into a single combined point table (Date, latitude, longitude, value, color) ready for spreadsheets or ArcGIS Online.

**Architecture:** All conversion logic lives in a dependency-free, framework-free pure-JavaScript module (`converter.js`) that runs identically in Node.js (for automated tests) and the browser. A single `convert.html` page provides drag-and-drop file input, settings fields, and a one-click download of the combined CSV. The `.act` color palette is supplied by the user at run time, so the tool works for any NEO dataset, not just sea-surface temperature.

**Tech Stack:** Vanilla JavaScript (ES2017), no build step, no npm dependencies. Node.js built-in test runner (`node:test`) for unit + integration tests. HTML5 File API + Blob download in the browser.

---

## Reference: Input Data Format

Read this before starting — it explains the data the tool consumes.

**NEO grid CSV** (sample files in `NEO-csv-files/`, e.g. `MYD28M_2025-05-01_rgb_360x180.csv`):
- A labeled grid. The first line is a header: cell A1 is the literal text `lat/lon`, followed by 360 longitude values (`-179.5, -178.5, … 179.5`).
- Each subsequent line is a data row: the first cell is a latitude (`89.5` down to `-89.5`), followed by 360 measured values.
- 181 lines total (1 header + 180 data rows); 361 comma-separated fields per line.
- No-data cells contain the sentinel value `99999.0` (mostly land for an SST dataset).
- Values are floating-point measurements (the sample is sea-surface temperature in °C, observed range −1.56 to 35.0).
- Each filename contains an ISO date `YYYY-MM-DD` (e.g. `2025-05-01`). Some files use the extension `.SS.CSV` instead of `.csv` — both are valid NEO downloads.

**`.act` palette** (sample: `NEO-csv-files/sst_35.act`):
- An Adobe Color Table: a 768-byte binary file = 256 colors × 3 bytes (R, G, B). Some `.act` files are 772 bytes; only the first 768 matter here.
- Palette index 0 is the color for the minimum value; index 255 is the color for the maximum value.

**Mapping a value to a color:** linearly scale the value between a user-supplied min and max onto palette index 0–255: `index = round((value - min) / (max - min) * 255)`, clamped to `[0, 255]`. The min/max are editable UI fields (default −2 and 35, matching `sst_35.act`) and stay constant for an entire processing run so colors are comparable across dates.

**Output:** one combined CSV with five columns — `Date, latitude, longitude, <value column name>, color`. `Date` is `MM/DD/YYYY`. The value column name is user-settable (default `value`). `color` is a lowercase hex string like `#01175a`. Rows whose value is the no-data sentinel are dropped. When multiple input files are given, all their rows are concatenated (sorted by date) into the single output file. The download filename encodes the data's date range, e.g. `neo_converted_2025-04-01_to_2026-03-01.csv` (or `neo_converted_2025-05-01.csv` for a single date).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `converter.js` | Pure conversion logic — no DOM. Parses filenames, `.act` palettes, and grid CSVs; maps values to colors; emits the combined CSV string. Runs in both Node and the browser. |
| `convert.html` | Single-page UI. File inputs + drag-and-drop, settings fields, glue code that reads files via the File API, calls `converter.js`, and triggers the download. |
| `tests/converter.test.js` | Node `node:test` unit tests for every `converter.js` function, plus integration tests against the real sample data. |
| `.gitignore` | Ignores `.DS_Store` and generated `neo_converted*.csv` files. |
| `NEO-csv-files/` | Pre-existing sample data (11 CSVs + `sst_35.act`). Used as fixtures by the integration tests. Do not modify. |

`converter.js` is wrapped in an IIFE that exports an object: `module.exports` under Node, and `window.Converter` in the browser. This single source of truth is unit-tested in Node and loaded directly by `convert.html` via `<script src="converter.js">` — no build step, no duplicated code.

**Test command (used throughout):** `node --test tests/converter.test.js`

---

## Task 1: Project Scaffold

**Files:**
- Create: `converter.js`
- Create: `tests/converter.test.js`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git**

Run: `git init`
Expected: `Initialized empty Git repository in …/convert-NEO-data/.git/`

- [ ] **Step 2: Create `.gitignore`**

Create `.gitignore` with this exact content:

```
.DS_Store
neo_converted*.csv
```

- [ ] **Step 3: Create the `converter.js` skeleton**

Create `converter.js` with this exact content:

```js
(function (root) {
  "use strict";

  var api = {};

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Converter = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 4: Create the test file with a smoke test**

Create `tests/converter.test.js` with this exact content:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const c = require("../converter.js");

test("converter module exports an object", () => {
  assert.strictEqual(typeof c, "object");
});
```

- [ ] **Step 5: Run the test suite**

Run: `node --test tests/converter.test.js`
Expected: PASS — output includes `# pass 1` and `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add converter.js tests/converter.test.js .gitignore
git commit -m "chore: scaffold NEO CSV converter project"
```

---

## Task 2: Extract Date From Filename

**Files:**
- Modify: `converter.js`
- Modify: `tests/converter.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/converter.test.js`:

```js
test("parseDateFromFilename converts a .csv filename to MM/DD/YYYY", () => {
  assert.strictEqual(
    c.parseDateFromFilename("MYD28M_2025-05-01_rgb_360x180.csv"),
    "05/01/2025"
  );
});

test("parseDateFromFilename handles the .SS.CSV extension", () => {
  assert.strictEqual(
    c.parseDateFromFilename("MYD28M_2025-04-01_rgb_360x180.SS.CSV"),
    "04/01/2025"
  );
});

test("parseDateFromFilename throws when no date is present", () => {
  assert.throws(() => c.parseDateFromFilename("no_date_here.csv"), /No date/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/converter.test.js`
Expected: FAIL — the three new tests error with `TypeError: c.parseDateFromFilename is not a function`.

- [ ] **Step 3: Implement the functions**

In `converter.js`, insert these two functions immediately above the `var api = {};` line:

```js
  function extractIsoDate(filename) {
    var m = String(filename).match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? { year: m[1], month: m[2], day: m[3] } : null;
  }

  function parseDateFromFilename(filename) {
    var d = extractIsoDate(filename);
    if (!d) {
      throw new Error("No date (YYYY-MM-DD) found in filename: " + filename);
    }
    return d.month + "/" + d.day + "/" + d.year;
  }

```

Then replace the `var api = {};` line with:

```js
  var api = {
    parseDateFromFilename: parseDateFromFilename
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/converter.test.js`
Expected: PASS — `# pass 4`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add converter.js tests/converter.test.js
git commit -m "feat: extract MM/DD/YYYY date from NEO filenames"
```

---

## Task 3: Map Value to Palette Index

**Files:**
- Modify: `converter.js`
- Modify: `tests/converter.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/converter.test.js`:

```js
test("valueToColorIndex maps min to 0 and max to 255", () => {
  assert.strictEqual(c.valueToColorIndex(-2, -2, 35), 0);
  assert.strictEqual(c.valueToColorIndex(35, -2, 35), 255);
});

test("valueToColorIndex maps the midpoint to 128", () => {
  assert.strictEqual(c.valueToColorIndex(16.5, -2, 35), 128);
});

test("valueToColorIndex clamps values outside the range", () => {
  assert.strictEqual(c.valueToColorIndex(100, -2, 35), 255);
  assert.strictEqual(c.valueToColorIndex(-100, -2, 35), 0);
});

test("valueToColorIndex throws when min equals max", () => {
  assert.throws(() => c.valueToColorIndex(10, 5, 5), /different/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/converter.test.js`
Expected: FAIL — new tests error with `TypeError: c.valueToColorIndex is not a function`.

- [ ] **Step 3: Implement the function**

In `converter.js`, insert this function immediately above the `var api = {` line:

```js
  function valueToColorIndex(value, min, max) {
    if (max === min) {
      throw new Error("min and max must be different");
    }
    var idx = Math.round(((value - min) / (max - min)) * 255);
    if (idx < 0) idx = 0;
    if (idx > 255) idx = 255;
    return idx;
  }

```

Then replace the `var api = {` block with:

```js
  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/converter.test.js`
Expected: PASS — `# pass 8`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add converter.js tests/converter.test.js
git commit -m "feat: map measured values to palette index 0-255"
```

---

## Task 4: Parse the `.act` Color Palette

**Files:**
- Modify: `converter.js`
- Modify: `tests/converter.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/converter.test.js`:

```js
test("parseActPalette returns 256 lowercase hex colors", () => {
  var bytes = new Uint8Array(768);
  bytes[15] = 255; // index 5, red
  bytes[16] = 128; // index 5, green
  bytes[17] = 0; // index 5, blue
  var palette = c.parseActPalette(bytes);
  assert.strictEqual(palette.length, 256);
  assert.strictEqual(palette[5], "#ff8000");
  assert.strictEqual(palette[0], "#000000");
});

test("parseActPalette accepts a 772-byte file", () => {
  var palette = c.parseActPalette(new Uint8Array(772));
  assert.strictEqual(palette.length, 256);
});

test("parseActPalette throws on a too-small file", () => {
  assert.throws(() => c.parseActPalette(new Uint8Array(100)), /too small/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/converter.test.js`
Expected: FAIL — new tests error with `TypeError: c.parseActPalette is not a function`.

- [ ] **Step 3: Implement the functions**

In `converter.js`, insert these two functions immediately above the `var api = {` line:

```js
  function toHex(n) {
    return n.toString(16).padStart(2, "0");
  }

  function parseActPalette(bytes) {
    if (!bytes || bytes.length < 768) {
      throw new Error(
        "ACT file too small: expected at least 768 bytes, got " +
          (bytes ? bytes.length : 0)
      );
    }
    var palette = [];
    for (var i = 0; i < 256; i++) {
      palette.push(
        "#" +
          toHex(bytes[i * 3]) +
          toHex(bytes[i * 3 + 1]) +
          toHex(bytes[i * 3 + 2])
      );
    }
    return palette;
  }

```

Then replace the `var api = {` block with:

```js
  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex,
    parseActPalette: parseActPalette
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/converter.test.js`
Expected: PASS — `# pass 11`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add converter.js tests/converter.test.js
git commit -m "feat: parse Adobe Color Table (.act) palette files"
```

---

## Task 5: Parse the NEO Grid CSV

**Files:**
- Modify: `converter.js`
- Modify: `tests/converter.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/converter.test.js`:

```js
test("parseGridCsv reads longitudes from the header and values from rows", () => {
  var text = "lat/lon,-179.5,-178.5\n0.5,10,99999.0\n-0.5,12.5,13";
  var grid = c.parseGridCsv(text);
  assert.deepStrictEqual(grid.longitudes, [-179.5, -178.5]);
  assert.strictEqual(grid.rows.length, 2);
  assert.deepStrictEqual(grid.rows[0], { lat: 0.5, values: [10, 99999] });
  assert.deepStrictEqual(grid.rows[1], { lat: -0.5, values: [12.5, 13] });
});

test("parseGridCsv ignores blank trailing lines", () => {
  var text = "lat/lon,-179.5\n0.5,10\n\n";
  var grid = c.parseGridCsv(text);
  assert.strictEqual(grid.rows.length, 1);
});

test("parseGridCsv throws when there are no data rows", () => {
  assert.throws(() => c.parseGridCsv("lat/lon,-179.5"), /no data rows/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/converter.test.js`
Expected: FAIL — new tests error with `TypeError: c.parseGridCsv is not a function`.

- [ ] **Step 3: Implement the function**

In `converter.js`, insert this function immediately above the `var api = {` line:

```js
  function parseGridCsv(text) {
    var lines = String(text)
      .split(/\r?\n/)
      .filter(function (line) {
        return line.trim() !== "";
      });
    if (lines.length < 2) {
      throw new Error("CSV has no data rows");
    }
    var header = lines[0].split(",");
    var longitudes = header.slice(1).map(function (s) {
      return parseFloat(s);
    });
    var rows = lines.slice(1).map(function (line) {
      var cells = line.split(",");
      return {
        lat: parseFloat(cells[0]),
        values: cells.slice(1).map(function (s) {
          return parseFloat(s);
        })
      };
    });
    return { longitudes: longitudes, rows: rows };
  }

```

Then replace the `var api = {` block with:

```js
  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex,
    parseActPalette: parseActPalette,
    parseGridCsv: parseGridCsv
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/converter.test.js`
Expected: PASS — `# pass 14`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add converter.js tests/converter.test.js
git commit -m "feat: parse NEO labeled grid CSV into longitudes and rows"
```

---

## Task 6: Convert a Single Grid to Point Rows

**Files:**
- Modify: `converter.js`
- Modify: `tests/converter.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/converter.test.js`:

```js
test("convertGrid skips no-data cells and maps each cell to a point row", () => {
  var pal = [];
  for (var i = 0; i < 256; i++) pal.push("idx" + i);
  var text = "lat/lon,-179.5,-178.5\n0.5,10,99999.0\n-0.5,12.5,13";
  var rows = c.convertGrid(text, "x_2025-05-01_y.csv", {
    min: 0,
    max: 100,
    noDataValue: 99999,
    palette: pal
  });
  assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(rows[0], {
    date: "05/01/2025",
    latitude: 0.5,
    longitude: -179.5,
    value: 10,
    color: "idx" + c.valueToColorIndex(10, 0, 100)
  });
  assert.strictEqual(rows[1].longitude, -179.5);
  assert.strictEqual(rows[1].latitude, -0.5);
  assert.strictEqual(rows[2].longitude, -178.5);
});

test("convertGrid skips cells whose value is not a number", () => {
  var pal = [];
  for (var i = 0; i < 256; i++) pal.push("idx" + i);
  var text = "lat/lon,-179.5,-178.5\n0.5,10,";
  var rows = c.convertGrid(text, "x_2025-05-01_y.csv", {
    min: 0,
    max: 100,
    noDataValue: 99999,
    palette: pal
  });
  assert.strictEqual(rows.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/converter.test.js`
Expected: FAIL — new tests error with `TypeError: c.convertGrid is not a function`.

- [ ] **Step 3: Implement the function**

In `converter.js`, insert this function immediately above the `var api = {` line:

```js
  function convertGrid(csvText, filename, options) {
    var date = parseDateFromFilename(filename);
    var grid = parseGridCsv(csvText);
    var out = [];
    for (var r = 0; r < grid.rows.length; r++) {
      var row = grid.rows[r];
      for (var col = 0; col < row.values.length; col++) {
        var value = row.values[col];
        if (Number.isNaN(value) || value === options.noDataValue) {
          continue;
        }
        var idx = valueToColorIndex(value, options.min, options.max);
        out.push({
          date: date,
          latitude: row.lat,
          longitude: grid.longitudes[col],
          value: value,
          color: options.palette[idx]
        });
      }
    }
    return out;
  }

```

Then replace the `var api = {` block with:

```js
  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex,
    parseActPalette: parseActPalette,
    parseGridCsv: parseGridCsv,
    convertGrid: convertGrid
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/converter.test.js`
Expected: PASS — `# pass 16`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add converter.js tests/converter.test.js
git commit -m "feat: convert a single grid CSV into colored point rows"
```

---

## Task 7: Serialize Rows to CSV Text

**Files:**
- Modify: `converter.js`
- Modify: `tests/converter.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/converter.test.js`:

```js
test("rowsToCsv writes a five-column header with the custom value name", () => {
  var csv = c.rowsToCsv(
    [
      {
        date: "05/01/2025",
        latitude: 0.5,
        longitude: -179.5,
        value: 28.74,
        color: "#01175a"
      }
    ],
    "SST"
  );
  var lines = csv.split("\n");
  assert.strictEqual(lines[0], "Date,latitude,longitude,SST,color");
  assert.strictEqual(lines[1], "05/01/2025,0.5,-179.5,28.74,#01175a");
  assert.strictEqual(lines[2], "");
});

test("rowsToCsv quotes a value column name that contains a comma", () => {
  var csv = c.rowsToCsv([], "Temp, C");
  assert.strictEqual(csv.split("\n")[0], 'Date,latitude,longitude,"Temp, C",color');
});

test("rowsToCsv with no rows outputs only the header line", () => {
  var csv = c.rowsToCsv([], "value");
  assert.strictEqual(csv, "Date,latitude,longitude,value,color\n");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/converter.test.js`
Expected: FAIL — new tests error with `TypeError: c.rowsToCsv is not a function`.

- [ ] **Step 3: Implement the functions**

In `converter.js`, insert these two functions immediately above the `var api = {` line:

```js
  function escapeCsv(field) {
    var s = String(field);
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function rowsToCsv(rows, valueColumnName) {
    var header = ["Date", "latitude", "longitude", valueColumnName, "color"]
      .map(escapeCsv)
      .join(",");
    var lines = rows.map(function (row) {
      return [row.date, row.latitude, row.longitude, row.value, row.color]
        .map(escapeCsv)
        .join(",");
    });
    return header + "\n" + lines.join("\n") + (lines.length ? "\n" : "");
  }

```

Then replace the `var api = {` block with:

```js
  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex,
    parseActPalette: parseActPalette,
    parseGridCsv: parseGridCsv,
    convertGrid: convertGrid,
    rowsToCsv: rowsToCsv
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/converter.test.js`
Expected: PASS — `# pass 19`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add converter.js tests/converter.test.js
git commit -m "feat: serialize point rows to five-column CSV text"
```

---

## Task 8: Combine Multiple Files Into One CSV

**Files:**
- Modify: `converter.js`
- Modify: `tests/converter.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/converter.test.js`:

```js
test("convertAll combines multiple files into one CSV", () => {
  var pal = [];
  for (var i = 0; i < 256; i++) pal.push("idx" + i);
  var entries = [
    { name: "a_2025-05-01.csv", text: "lat/lon,-179.5\n0.5,10" },
    { name: "b_2025-06-01.csv", text: "lat/lon,-179.5\n0.5,20\n-0.5,30" }
  ];
  var csv = c.convertAll(entries, {
    min: 0,
    max: 100,
    noDataValue: 99999,
    valueColumnName: "value",
    palette: pal
  });
  var lines = csv.split("\n");
  assert.strictEqual(lines[0], "Date,latitude,longitude,value,color");
  assert.strictEqual(lines.length, 5); // header + 3 rows + trailing ""
});

test("convertAll sorts rows by date regardless of input order", () => {
  var pal = [];
  for (var i = 0; i < 256; i++) pal.push("idx" + i);
  var entries = [
    { name: "b_2025-06-01.csv", text: "lat/lon,-179.5\n0.5,20" },
    { name: "a_2025-05-01.csv", text: "lat/lon,-179.5\n0.5,10" }
  ];
  var csv = c.convertAll(entries, {
    min: 0,
    max: 100,
    noDataValue: 99999,
    valueColumnName: "value",
    palette: pal
  });
  var lines = csv.split("\n");
  assert.match(lines[1], /^05\/01\/2025,/);
  assert.match(lines[2], /^06\/01\/2025,/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/converter.test.js`
Expected: FAIL — new tests error with `TypeError: c.convertAll is not a function`.

- [ ] **Step 3: Implement the functions**

In `converter.js`, insert these two functions immediately above the `var api = {` line:

```js
  function fileSortKey(filename) {
    var d = extractIsoDate(filename);
    return d ? d.year + d.month + d.day : "";
  }

  function convertAll(fileEntries, options) {
    var sorted = fileEntries.slice().sort(function (a, b) {
      var ka = fileSortKey(a.name);
      var kb = fileSortKey(b.name);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    var allRows = [];
    for (var i = 0; i < sorted.length; i++) {
      allRows = allRows.concat(
        convertGrid(sorted[i].text, sorted[i].name, options)
      );
    }
    return rowsToCsv(allRows, options.valueColumnName);
  }

```

Then replace the `var api = {` block with:

```js
  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex,
    parseActPalette: parseActPalette,
    parseGridCsv: parseGridCsv,
    convertGrid: convertGrid,
    rowsToCsv: rowsToCsv,
    convertAll: convertAll
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/converter.test.js`
Expected: PASS — `# pass 21`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add converter.js tests/converter.test.js
git commit -m "feat: combine and date-sort multiple grids into one CSV"
```

---

## Task 9: Name the Output File by Date Range

**Files:**
- Modify: `converter.js`
- Modify: `tests/converter.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/converter.test.js`:

```js
test("outputFilename encodes the date range across multiple files", () => {
  var name = c.outputFilename([
    { name: "MYD28M_2026-03-01_rgb_360x180.csv", text: "" },
    { name: "MYD28M_2025-04-01_rgb_360x180.csv", text: "" },
    { name: "MYD28M_2025-09-01_rgb_360x180.csv", text: "" }
  ]);
  assert.strictEqual(name, "neo_converted_2025-04-01_to_2026-03-01.csv");
});

test("outputFilename uses a single date when all files share one date", () => {
  var name = c.outputFilename([
    { name: "MYD28M_2025-05-01_rgb_360x180.csv", text: "" }
  ]);
  assert.strictEqual(name, "neo_converted_2025-05-01.csv");
});

test("outputFilename falls back to a plain name when no dates are found", () => {
  var name = c.outputFilename([{ name: "no_date_here.csv", text: "" }]);
  assert.strictEqual(name, "neo_converted.csv");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/converter.test.js`
Expected: FAIL — new tests error with `TypeError: c.outputFilename is not a function`.

- [ ] **Step 3: Implement the function**

In `converter.js`, insert this function immediately above the `var api = {` line:

```js
  function outputFilename(fileEntries) {
    var isos = fileEntries
      .map(function (e) {
        return extractIsoDate(e.name);
      })
      .filter(function (d) {
        return d !== null;
      })
      .map(function (d) {
        return d.year + "-" + d.month + "-" + d.day;
      })
      .sort();
    if (isos.length === 0) {
      return "neo_converted.csv";
    }
    var first = isos[0];
    var last = isos[isos.length - 1];
    if (first === last) {
      return "neo_converted_" + first + ".csv";
    }
    return "neo_converted_" + first + "_to_" + last + ".csv";
  }

```

Then replace the `var api = {` block with:

```js
  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex,
    parseActPalette: parseActPalette,
    parseGridCsv: parseGridCsv,
    convertGrid: convertGrid,
    rowsToCsv: rowsToCsv,
    convertAll: convertAll,
    outputFilename: outputFilename
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/converter.test.js`
Expected: PASS — `# pass 24`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add converter.js tests/converter.test.js
git commit -m "feat: name the output file by its data date range"
```

---

## Task 10: Integration Tests Against Real NEO Data

**Files:**
- Modify: `tests/converter.test.js`

- [ ] **Step 1: Write the failing integration tests**

Append to `tests/converter.test.js`:

```js
test("integration: converts a real NEO SST CSV file", (t) => {
  var dataDir = path.join(__dirname, "..", "NEO-csv-files");
  var csvPath = path.join(dataDir, "MYD28M_2025-05-01_rgb_360x180.csv");
  var actPath = path.join(dataDir, "sst_35.act");
  if (!fs.existsSync(csvPath) || !fs.existsSync(actPath)) {
    t.skip("NEO-csv-files sample data not present");
    return;
  }
  var palette = c.parseActPalette(new Uint8Array(fs.readFileSync(actPath)));
  var rows = c.convertGrid(
    fs.readFileSync(csvPath, "utf8"),
    "MYD28M_2025-05-01_rgb_360x180.csv",
    { min: -2, max: 35, noDataValue: 99999, palette: palette }
  );
  assert.strictEqual(rows.length, 34451);
  var sample = rows.find(
    (r) => r.latitude === 0.5 && r.longitude === -179.5
  );
  assert.ok(sample, "expected a row at lat 0.5 lon -179.5");
  assert.strictEqual(sample.date, "05/01/2025");
  assert.strictEqual(sample.value, 28.74);
  assert.strictEqual(
    sample.color,
    palette[c.valueToColorIndex(28.74, -2, 35)]
  );
  assert.match(sample.color, /^#[0-9a-f]{6}$/);
});

test("integration: convertAll combines two real files, date-sorted", (t) => {
  var dataDir = path.join(__dirname, "..", "NEO-csv-files");
  var june = "MYD28M_2025-06-01_rgb_360x180.csv";
  var may = "MYD28M_2025-05-01_rgb_360x180.csv";
  var actPath = path.join(dataDir, "sst_35.act");
  if (
    !fs.existsSync(path.join(dataDir, june)) ||
    !fs.existsSync(path.join(dataDir, may)) ||
    !fs.existsSync(actPath)
  ) {
    t.skip("NEO-csv-files sample data not present");
    return;
  }
  var palette = c.parseActPalette(new Uint8Array(fs.readFileSync(actPath)));
  var entries = [
    { name: june, text: fs.readFileSync(path.join(dataDir, june), "utf8") },
    { name: may, text: fs.readFileSync(path.join(dataDir, may), "utf8") }
  ];
  var csv = c.convertAll(entries, {
    min: -2,
    max: 35,
    noDataValue: 99999,
    valueColumnName: "SST",
    palette: palette
  });
  var lines = csv.split("\n");
  assert.strictEqual(lines[0], "Date,latitude,longitude,SST,color");
  // 34451 (May) + 35936 (June) data rows + header + trailing ""
  assert.strictEqual(lines.length, 34451 + 35936 + 2);
  assert.match(lines[1], /^05\/01\/2025,/);
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `node --test tests/converter.test.js`
Expected: PASS — `# pass 26`, `# fail 0`. (If the `NEO-csv-files/` folder is absent these two tests report as skipped instead of failing; the folder is present in this repo, so expect a pass.)

- [ ] **Step 3: Commit**

```bash
git add tests/converter.test.js NEO-csv-files
git commit -m "test: add integration tests against real NEO sample data"
```

---

## Task 11: Build the Web Page

**Files:**
- Create: `convert.html`

This task creates the browser UI. There is no unit test for DOM glue code; it is verified by loading the page (Step 2 here) and end-to-end in Task 12.

- [ ] **Step 1: Create `convert.html`**

Create `convert.html` with this exact content:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NEO CSV Converter</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 720px;
        margin: 2rem auto;
        padding: 0 1rem;
        color: #1a1a1a;
        line-height: 1.45;
      }
      h1 {
        font-size: 1.4rem;
      }
      fieldset {
        border: 1px solid #ccc;
        border-radius: 6px;
        margin-bottom: 1rem;
        padding: 1rem;
      }
      legend {
        font-weight: 600;
        padding: 0 0.4rem;
      }
      label {
        display: block;
        margin: 0.6rem 0 0.2rem;
        font-size: 0.9rem;
      }
      input[type="text"],
      input[type="number"] {
        padding: 0.35rem;
        width: 12rem;
        font-size: 1rem;
      }
      #drop {
        border: 2px dashed #888;
        border-radius: 6px;
        padding: 2rem;
        text-align: center;
        color: #555;
        cursor: pointer;
      }
      #drop.over {
        background: #eef;
        border-color: #44f;
      }
      button {
        background: #2454c4;
        color: #fff;
        border: 0;
        border-radius: 6px;
        padding: 0.6rem 1.2rem;
        font-size: 1rem;
        cursor: pointer;
      }
      button:disabled {
        background: #999;
        cursor: not-allowed;
      }
      #status {
        margin-top: 1rem;
        white-space: pre-wrap;
        font-size: 0.9rem;
      }
      .err {
        color: #b00020;
      }
      .ok {
        color: #1a7f37;
      }
      ul {
        font-size: 0.85rem;
        margin: 0.4rem 0;
      }
    </style>
  </head>
  <body>
    <h1>NASA Earth Observations CSV Converter</h1>
    <p>
      Converts NEO grid CSV files into a single point table with columns:
      Date, latitude, longitude, value, color.
    </p>

    <fieldset>
      <legend>1. Color palette</legend>
      <label for="actInput">Adobe Color Table (.act) file</label>
      <input type="file" id="actInput" accept=".act" />
      <div id="actStatus"></div>
    </fieldset>

    <fieldset>
      <legend>2. Settings</legend>
      <label for="valueName">Value column name</label>
      <input type="text" id="valueName" value="value" />
      <label for="minVal">Minimum value (maps to first palette color)</label>
      <input type="number" id="minVal" value="-2" step="any" />
      <label for="maxVal">Maximum value (maps to last palette color)</label>
      <input type="number" id="maxVal" value="35" step="any" />
    </fieldset>

    <fieldset>
      <legend>3. CSV files</legend>
      <div id="drop">
        Drop NEO CSV files or a folder here, or click to choose files
      </div>
      <input type="file" id="csvInput" accept=".csv" multiple hidden />
      <div id="fileList"></div>
    </fieldset>

    <button id="convertBtn" disabled>Convert &amp; Download</button>
    <div id="status"></div>

    <script src="converter.js"></script>
    <script>
      (function () {
        "use strict";

        var palette = null;
        var csvFiles = []; // array of File objects

        var actInput = document.getElementById("actInput");
        var actStatus = document.getElementById("actStatus");
        var csvInput = document.getElementById("csvInput");
        var drop = document.getElementById("drop");
        var fileList = document.getElementById("fileList");
        var convertBtn = document.getElementById("convertBtn");
        var status = document.getElementById("status");

        function setStatus(msg, cls) {
          status.textContent = msg;
          status.className = cls || "";
        }

        function updateButton() {
          convertBtn.disabled = !(palette && csvFiles.length > 0);
        }

        // --- palette loading ---
        actInput.addEventListener("change", function () {
          var file = actInput.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            try {
              palette = Converter.parseActPalette(
                new Uint8Array(reader.result)
              );
              actStatus.textContent =
                "Loaded palette: " +
                file.name +
                " (" +
                palette.length +
                " colors)";
              actStatus.className = "ok";
            } catch (e) {
              palette = null;
              actStatus.textContent = "Error: " + e.message;
              actStatus.className = "err";
            }
            updateButton();
          };
          reader.readAsArrayBuffer(file);
        });

        // --- CSV collection ---
        function addCsvFiles(files) {
          for (var i = 0; i < files.length; i++) {
            if (/\.csv$/i.test(files[i].name)) {
              csvFiles.push(files[i]);
            }
          }
          renderFileList();
          updateButton();
        }

        function renderFileList() {
          fileList.textContent = "";
          if (csvFiles.length === 0) return;
          var heading = document.createElement("div");
          heading.textContent = csvFiles.length + " CSV file(s):";
          fileList.appendChild(heading);
          var ul = document.createElement("ul");
          for (var i = 0; i < csvFiles.length; i++) {
            var li = document.createElement("li");
            li.textContent = csvFiles[i].name;
            ul.appendChild(li);
          }
          fileList.appendChild(ul);
        }

        drop.addEventListener("click", function () {
          csvInput.click();
        });
        csvInput.addEventListener("change", function () {
          addCsvFiles(csvInput.files);
        });

        drop.addEventListener("dragover", function (e) {
          e.preventDefault();
          drop.classList.add("over");
        });
        drop.addEventListener("dragleave", function () {
          drop.classList.remove("over");
        });
        drop.addEventListener("drop", function (e) {
          e.preventDefault();
          drop.classList.remove("over");
          var items = e.dataTransfer.items;
          if (items && items.length && items[0].webkitGetAsEntry) {
            var entries = [];
            for (var i = 0; i < items.length; i++) {
              var entry = items[i].webkitGetAsEntry();
              if (entry) entries.push(entry);
            }
            collectEntries(entries, []).then(addCsvFiles);
          } else {
            addCsvFiles(e.dataTransfer.files);
          }
        });

        // Recursively walk dropped FileSystemEntry items (handles folders).
        function collectEntries(entries, acc) {
          return entries
            .reduce(function (p, entry) {
              return p.then(function () {
                if (entry.isFile) {
                  return new Promise(function (resolve) {
                    entry.file(function (f) {
                      acc.push(f);
                      resolve();
                    });
                  });
                }
                if (entry.isDirectory) {
                  return readDir(entry).then(function (children) {
                    return collectEntries(children, acc);
                  });
                }
              });
            }, Promise.resolve())
            .then(function () {
              return acc;
            });
        }

        function readDir(dirEntry) {
          return new Promise(function (resolve) {
            var reader = dirEntry.createReader();
            var all = [];
            (function readBatch() {
              reader.readEntries(function (batch) {
                if (batch.length === 0) {
                  resolve(all);
                } else {
                  all = all.concat(Array.prototype.slice.call(batch));
                  readBatch();
                }
              });
            })();
          });
        }

        // --- file reading ---
        function readText(file) {
          return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
              resolve(reader.result);
            };
            reader.onerror = function () {
              reject(reader.error);
            };
            reader.readAsText(file);
          });
        }

        // --- convert + download ---
        convertBtn.addEventListener("click", function () {
          var min = parseFloat(document.getElementById("minVal").value);
          var max = parseFloat(document.getElementById("maxVal").value);
          var valueColumnName =
            document.getElementById("valueName").value.trim() || "value";
          if (Number.isNaN(min) || Number.isNaN(max) || min === max) {
            setStatus(
              "Please enter valid, different minimum and maximum values.",
              "err"
            );
            return;
          }
          convertBtn.disabled = true;
          setStatus("Reading " + csvFiles.length + " file(s)...");
          Promise.all(
            csvFiles.map(function (file) {
              return readText(file).then(function (text) {
                return { name: file.name, text: text };
              });
            })
          )
            .then(function (entries) {
              var csv = Converter.convertAll(entries, {
                min: min,
                max: max,
                noDataValue: 99999,
                valueColumnName: valueColumnName,
                palette: palette
              });
              var rowCount = csv.split("\n").length - 2;
              var filename = Converter.outputFilename(entries);
              downloadCsv(csv, filename);
              setStatus(
                "Done. Wrote " +
                  rowCount +
                  " rows from " +
                  entries.length +
                  " file(s) to " +
                  filename,
                "ok"
              );
            })
            .catch(function (e) {
              setStatus("Error: " + e.message, "err");
            })
            .then(function () {
              updateButton();
            });
        });

        function downloadCsv(text, filename) {
          var blob = new Blob([text], { type: "text/csv" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 1000);
        }
      })();
    </script>
  </body>
</html>
```

- [ ] **Step 2: Open the page and confirm it renders**

Open `convert.html` in a web browser (double-click the file, or `open convert.html` on macOS).
Expected: the page shows the title, three numbered sections (Color palette, Settings, CSV files), and a disabled "Convert & Download" button. Open the browser developer console (View → Developer → JavaScript Console) and confirm there are **no errors** — in particular no error about `Converter` being undefined (that would mean `converter.js` failed to load).

- [ ] **Step 3: Commit**

```bash
git add convert.html
git commit -m "feat: add web page UI for batch NEO CSV conversion"
```

---

## Task 12: End-to-End Verification

**Files:** none (verification only)

This task confirms the whole pipeline works in a browser against the real sample data.

- [ ] **Step 1: Load the page and the palette**

Open `convert.html` in a browser. Under "1. Color palette", click the file picker and choose `NEO-csv-files/sst_35.act`.
Expected: status text reads `Loaded palette: sst_35.act (256 colors)` in green.

- [ ] **Step 2: Set conversion settings**

Under "2. Settings": set "Value column name" to `SST`, leave "Minimum value" at `-2` and "Maximum value" at `35`.

- [ ] **Step 3: Load all 11 sample CSV files**

Under "3. CSV files", click the drop zone. In the file picker, navigate to the `NEO-csv-files/` folder and select all 11 CSV files (the `.csv` and `.SS.CSV` files — do **not** select `sst_35.act`).
Expected: the file list shows `11 CSV file(s):` followed by the 11 filenames. The "Convert & Download" button is now enabled.

- [ ] **Step 4: Convert and download**

Click "Convert & Download".
Expected: status text reads `Done. Wrote 390771 rows from 11 file(s) to neo_converted_2025-04-01_to_2026-03-01.csv` in green, and the browser downloads that file. The date range in the name is the earliest and latest date among the 11 input files.

- [ ] **Step 5: Verify the downloaded file**

In a terminal, `cd` to the folder containing the downloaded file:

Run: `head -1 neo_converted_2025-04-01_to_2026-03-01.csv`
Expected: `Date,latitude,longitude,SST,color`

Run: `wc -l < neo_converted_2025-04-01_to_2026-03-01.csv`
Expected: `390772` (1 header line + 390771 data rows).

Run: `tail -n +2 neo_converted_2025-04-01_to_2026-03-01.csv | cut -d, -f5 | sort -u | head`
Expected: every line is a lowercase hex color matching `#` followed by 6 hex digits (e.g. `#001659`).

Run: `tail -n +2 neo_converted_2025-04-01_to_2026-03-01.csv | cut -d, -f1 | sort -u`
Expected: 11 distinct dates in `MM/DD/YYYY` format (`04/01/2025` through `03/01/2026`), confirming the date column and multi-file combine.

- [ ] **Step 6: Verify drag-and-drop of a folder**

Reload `convert.html`, reload `sst_35.act`, then drag the entire `NEO-csv-files/` folder from the file manager onto the drop zone.
Expected: the file list shows `11 CSV file(s):` (the `.act` file inside the folder is ignored by the `.csv` filter). Clicking "Convert & Download" again produces the same `Done. Wrote 390771 rows…` result.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: complete end-to-end verification of NEO CSV converter"
```

(If `git status` shows nothing to commit because no files changed during verification, skip this commit.)

---

## Done

When all tasks are complete the deliverable is: open `convert.html` in any modern browser, supply a `.act` palette and a batch of NEO CSV files, and download one combined `Date, latitude, longitude, <value>, color` CSV ready for spreadsheets or ArcGIS Online.

**Optional future enhancement (out of scope):** to ship the tool as a single self-contained HTML file, the contents of `converter.js` can be pasted into an inline `<script>` block in `convert.html`, replacing the `<script src="converter.js">` tag. This is deferred so that `converter.js` stays a separately testable module during development.
