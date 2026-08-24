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

  function isValidRange(min, max) {
    if (min == null || min === "" || max == null || max === "") return true;
    return min <= max;
  }

  function matchesStatus(shop, status) {
    return !status || shop.status === status;
  }

  var filterMatchers = {
    search: function (shop, value) { return matchesSearch(shop, value); },
    zone: function (shop, value) { return matchesZone(shop, value); },
    status: function (shop, value) { return matchesStatus(shop, value); },
    dateRange: function (shop, value) {
      var range = value || {};
      return matchesDateRange(shop.visitDate, range.from, range.to);
    }
  };

  function applyFilters(shop, filters) {
    var f = filters || {};
    return Object.keys(filterMatchers).every(function (key) {
      return filterMatchers[key](shop, f[key]);
    });
  }

  // Config central del proveedor de geocodificación. Aislada acá para poder
  // reemplazar Nominatim por otro proveedor a futuro tocando solo esta
  // constante y buildGeocodeUrl/parseGeocodeResults, sin tocar la UI.
  var GEOCODE_CONFIG = {
    endpoint: "https://nominatim.openstreetmap.org/search",
    countryCodes: "ar",
    // Bounding box de Paraná ciudad (Entre Ríos), formato viewbox de Nominatim:
    // izquierda,arriba,derecha,abajo. A propósito es más amplio que el
    // microcentroBounds operativo del mapa (ver nota en index.html).
    viewbox: "-60.5935,-31.6874,-60.3912,-31.8041",
    bounded: 1,
    limit: 5,
    cityContext: "Paraná, Entre Ríos, Argentina"
  };

  function normalizeQueryText(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
  }

  function buildGeocodeQuery(value) {
    var trimmed = normalizeQueryText(value);
    if (!trimmed) return "";
    var mentionsParana = normalizeText(trimmed).indexOf("parana") !== -1;
    return mentionsParana ? trimmed : (trimmed + ", " + GEOCODE_CONFIG.cityContext);
  }

  function buildGeocodeUrl(query) {
    var q = buildGeocodeQuery(query);
    if (!q) return "";
    var params = new URLSearchParams({
      q: q,
      format: "jsonv2",
      limit: String(GEOCODE_CONFIG.limit),
      countrycodes: GEOCODE_CONFIG.countryCodes,
      viewbox: GEOCODE_CONFIG.viewbox,
      bounded: String(GEOCODE_CONFIG.bounded)
    });
    return GEOCODE_CONFIG.endpoint + "?" + params.toString();
  }

  function toFiniteCoordinate(value) {
    if (value === null || value === undefined || value === "") return NaN;
    var n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  function parseGeocodeResults(rawResults) {
    if (!Array.isArray(rawResults)) return [];
    return rawResults
      .map(function (item) {
        var lat = toFiniteCoordinate(item && item.lat);
        var lng = toFiniteCoordinate(item && item.lon);
        var label = (item && typeof item.display_name === "string") ? item.display_name : "";
        return { lat: lat, lng: lng, label: label };
      })
      .filter(function (result) {
        return Number.isFinite(result.lat) && Number.isFinite(result.lng) && Boolean(result.label);
      });
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
    matchesZone: matchesZone,
    isValidRange: isValidRange,
    matchesStatus: matchesStatus,
    filterMatchers: filterMatchers,
    applyFilters: applyFilters,
    GEOCODE_CONFIG: GEOCODE_CONFIG,
    normalizeQueryText: normalizeQueryText,
    buildGeocodeQuery: buildGeocodeQuery,
    buildGeocodeUrl: buildGeocodeUrl,
    parseGeocodeResults: parseGeocodeResults
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
  } else {
    root.Core = Core;
  }
})(typeof window !== "undefined" ? window : globalThis);
