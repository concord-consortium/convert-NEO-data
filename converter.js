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

  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex,
    parseActPalette: parseActPalette,
    parseGridCsv: parseGridCsv,
    convertGrid: convertGrid,
    rowsToCsv: rowsToCsv,
    convertAll: convertAll
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Converter = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
