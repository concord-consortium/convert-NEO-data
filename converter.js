(function (root) {
  "use strict";

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

  function valueToColorIndex(value, min, max) {
    if (max === min) {
      throw new Error("min and max must be different");
    }
    var idx = Math.round(((value - min) / (max - min)) * 255);
    if (idx < 0) idx = 0;
    if (idx > 255) idx = 255;
    return idx;
  }

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

  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex,
    parseActPalette: parseActPalette
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Converter = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
