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

  function convertSeparate(fileEntries, options) {
    var sorted = fileEntries.slice().sort(function (a, b) {
      var ka = fileSortKey(a.name);
      var kb = fileSortKey(b.name);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    var used = {};
    var out = [];
    for (var i = 0; i < sorted.length; i++) {
      var csv = rowsToCsv(
        convertGrid(sorted[i].text, sorted[i].name, options),
        options.valueColumnName
      );
      var name = outputFilename([sorted[i]]);
      if (used[name]) {
        used[name] += 1;
        name = name.replace(/\.csv$/, "") + "_" + used[name] + ".csv";
      } else {
        used[name] = 1;
      }
      out.push({ name: name, content: csv });
    }
    return out;
  }

  var crc32Table = null;
  function crc32(bytes) {
    if (!crc32Table) {
      crc32Table = [];
      for (var n = 0; n < 256; n++) {
        var cc = n;
        for (var k = 0; k < 8; k++) {
          cc = cc & 1 ? 0xedb88320 ^ (cc >>> 1) : cc >>> 1;
        }
        crc32Table[n] = cc >>> 0;
      }
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crc32Table[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concatBytes(parts) {
    var total = 0;
    for (var i = 0; i < parts.length; i++) {
      total += parts[i].length;
    }
    var out = new Uint8Array(total);
    var pos = 0;
    for (var j = 0; j < parts.length; j++) {
      out.set(parts[j], pos);
      pos += parts[j].length;
    }
    return out;
  }

  // Build an uncompressed (stored) ZIP archive from [{name, content}] entries.
  function buildZip(files) {
    var encoder = new TextEncoder();
    function u16(n) {
      return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
    }
    function u32(n) {
      return new Uint8Array([
        n & 0xff,
        (n >>> 8) & 0xff,
        (n >>> 16) & 0xff,
        (n >>> 24) & 0xff
      ]);
    }
    var chunks = [];
    var central = [];
    var offset = 0;
    for (var i = 0; i < files.length; i++) {
      var nameBytes = encoder.encode(files[i].name);
      var dataBytes = encoder.encode(files[i].content);
      var crc = crc32(dataBytes);
      var local = concatBytes([
        u32(0x04034b50), // local file header signature
        u16(20), // version needed to extract
        u16(0), // general purpose flags
        u16(0), // compression method: 0 = stored
        u16(0), // last mod time
        u16(0), // last mod date
        u32(crc),
        u32(dataBytes.length), // compressed size
        u32(dataBytes.length), // uncompressed size
        u16(nameBytes.length),
        u16(0), // extra field length
        nameBytes
      ]);
      chunks.push(local, dataBytes);
      central.push(
        concatBytes([
          u32(0x02014b50), // central directory header signature
          u16(20), // version made by
          u16(20), // version needed to extract
          u16(0), // general purpose flags
          u16(0), // compression method
          u16(0), // last mod time
          u16(0), // last mod date
          u32(crc),
          u32(dataBytes.length),
          u32(dataBytes.length),
          u16(nameBytes.length),
          u16(0), // extra field length
          u16(0), // file comment length
          u16(0), // disk number start
          u16(0), // internal file attributes
          u32(0), // external file attributes
          u32(offset), // offset of local header
          nameBytes
        ])
      );
      offset += local.length + dataBytes.length;
    }
    var centralBytes = concatBytes(central);
    var end = concatBytes([
      u32(0x06054b50), // end of central directory signature
      u16(0), // number of this disk
      u16(0), // disk where central directory starts
      u16(files.length), // central directory records on this disk
      u16(files.length), // total central directory records
      u32(centralBytes.length), // size of central directory
      u32(offset), // offset of central directory
      u16(0) // comment length
    ]);
    chunks.push(centralBytes, end);
    return concatBytes(chunks);
  }

  var api = {
    parseDateFromFilename: parseDateFromFilename,
    valueToColorIndex: valueToColorIndex,
    parseActPalette: parseActPalette,
    parseGridCsv: parseGridCsv,
    convertGrid: convertGrid,
    rowsToCsv: rowsToCsv,
    convertAll: convertAll,
    convertSeparate: convertSeparate,
    outputFilename: outputFilename,
    buildZip: buildZip
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Converter = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
