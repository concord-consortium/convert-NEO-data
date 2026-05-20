"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const c = require("../converter.js");

test("converter module exports an object", () => {
  assert.strictEqual(typeof c, "object");
});
