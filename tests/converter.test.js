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
