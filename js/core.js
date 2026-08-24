(function (root) {
  "use strict";

  var ANALYSTS = {
    magali: { id: "magali", name: "Magali" },
    victoria: { id: "victoria", name: "Victoria" }
  };

  function isValidAnalystId(id) {
    return id === "magali" || id === "victoria";
  }

  function getSafeActiveAnalyst(stored) {
    return isValidAnalystId(stored) ? stored : "magali";
  }

  function migrateLegacyData(parsedV1) {
    var legacyShops = Array.isArray(parsedV1) ? parsedV1 : [];
    return {
      version: 2,
      analysts: {
        magali: { shops: legacyShops.slice() },
        victoria: { shops: [] }
      }
    };
  }

  function inRange(value, min, max) {
    if (value == null || Number.isNaN(value)) return false;
    if (min != null && !Number.isNaN(min) && value < min) return false;
    if (max != null && !Number.isNaN(max) && value > max) return false;
    return true;
  }

  function toEpoch(dateStr) {
    if (!dateStr) return null;
    var t = new Date(dateStr + "T00:00:00").getTime();
    return Number.isNaN(t) ? null : t;
  }

  function matchesDateRange(dateStr, from, to) {
    var fromEpoch = toEpoch(from);
    var toEpochValue = toEpoch(to);
    if (fromEpoch == null && toEpochValue == null) return true;

    var valueEpoch = toEpoch(dateStr);
    if (valueEpoch == null) return false;

    return inRange(valueEpoch, fromEpoch, toEpochValue);
  }

  function normalizeText(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  var SEARCH_FIELDS = ["name", "category", "address", "zone", "contact", "notes"];

  function matchesSearch(shop, query) {
    var q = normalizeText(query);
    if (!q) return true;
    var haystack = normalizeText(
      SEARCH_FIELDS.map(function (field) { return shop[field]; }).join(" ")
    );
    return haystack.indexOf(q) !== -1;
  }

  function matchesZone(shop, zoneQuery) {
    var q = normalizeText(zoneQuery);
    if (!q) return true;
    var source = shop.zone && String(shop.zone).trim() ? shop.zone : shop.address;
    return normalizeText(source).indexOf(q) !== -1;
  }

  var Core = {
    ANALYSTS: ANALYSTS,
    isValidAnalystId: isValidAnalystId,
    getSafeActiveAnalyst: getSafeActiveAnalyst,
    migrateLegacyData: migrateLegacyData,
    inRange: inRange,
    toEpoch: toEpoch,
    matchesDateRange: matchesDateRange,
    normalizeText: normalizeText,
    matchesSearch: matchesSearch,
    matchesZone: matchesZone
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
  } else {
    root.Core = Core;
  }
})(typeof window !== "undefined" ? window : globalThis);
