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

  var Core = {
    ANALYSTS: ANALYSTS,
    isValidAnalystId: isValidAnalystId,
    getSafeActiveAnalyst: getSafeActiveAnalyst,
    migrateLegacyData: migrateLegacyData
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
  } else {
    root.Core = Core;
  }
})(typeof window !== "undefined" ? window : globalThis);
