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
