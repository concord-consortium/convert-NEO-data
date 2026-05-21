"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const c = require("../converter.js");

test("converter module exports an object", () => {
  assert.strictEqual(typeof c, "object");
});

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

test("convertSeparate converts each file to its own dated CSV, date-sorted", () => {
  var pal = [];
  for (var i = 0; i < 256; i++) pal.push("idx" + i);
  var entries = [
    { name: "b_2025-06-01.csv", text: "lat/lon,-179.5\n0.5,20\n-0.5,30" },
    { name: "a_2025-05-01.csv", text: "lat/lon,-179.5\n0.5,10" }
  ];
  var parts = c.convertSeparate(entries, {
    min: 0,
    max: 100,
    noDataValue: 99999,
    valueColumnName: "value",
    palette: pal
  });
  assert.strictEqual(parts.length, 2);
  assert.strictEqual(parts[0].name, "neo_converted_2025-05-01.csv");
  assert.strictEqual(parts[1].name, "neo_converted_2025-06-01.csv");
  assert.strictEqual(
    parts[0].content.split("\n")[0],
    "Date,latitude,longitude,value,color"
  );
  assert.strictEqual(parts[0].content.split("\n").length - 2, 1);
  assert.strictEqual(parts[1].content.split("\n").length - 2, 2);
});

test("convertSeparate disambiguates files that resolve to the same date", () => {
  var pal = [];
  for (var i = 0; i < 256; i++) pal.push("idx" + i);
  var entries = [
    { name: "x_2025-05-01.csv", text: "lat/lon,-179.5\n0.5,10" },
    { name: "y_2025-05-01.csv", text: "lat/lon,-179.5\n0.5,20" }
  ];
  var parts = c.convertSeparate(entries, {
    min: 0,
    max: 100,
    noDataValue: 99999,
    valueColumnName: "value",
    palette: pal
  });
  assert.strictEqual(parts.length, 2);
  assert.strictEqual(parts[0].name, "neo_converted_2025-05-01.csv");
  assert.strictEqual(parts[1].name, "neo_converted_2025-05-01_2.csv");
});

test("buildZip produces a valid stored-zip container with correct CRCs", () => {
  var zlib = require("node:zlib");
  var zip = c.buildZip([
    { name: "first.csv", content: "hello world" },
    { name: "second.csv", content: "second file body" }
  ]);
  assert.ok(zip instanceof Uint8Array);
  assert.deepStrictEqual(
    [zip[0], zip[1], zip[2], zip[3]],
    [0x50, 0x4b, 0x03, 0x04]
  );
  var crc =
    (zip[14] | (zip[15] << 8) | (zip[16] << 16) | (zip[17] << 24)) >>> 0;
  assert.strictEqual(crc, zlib.crc32("hello world") >>> 0);
  var hasEnd = false;
  for (var i = 0; i < zip.length - 3; i++) {
    if (
      zip[i] === 0x50 &&
      zip[i + 1] === 0x4b &&
      zip[i + 2] === 0x05 &&
      zip[i + 3] === 0x06
    ) {
      hasEnd = true;
      assert.strictEqual(zip[i + 10] | (zip[i + 11] << 8), 2);
      break;
    }
  }
  assert.ok(hasEnd, "expected end-of-central-directory record");
  var text = Buffer.from(zip).toString("latin1");
  assert.ok(text.indexOf("hello world") !== -1);
  assert.ok(text.indexOf("second file body") !== -1);
  assert.ok(text.indexOf("first.csv") !== -1);
});
