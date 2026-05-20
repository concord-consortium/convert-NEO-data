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
