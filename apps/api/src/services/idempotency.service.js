const crypto = require("crypto");

// Canonical JSON: urutan key stabil secara rekursif, sehingga payload yang
// sama menghasilkan hash yang sama tanpa peduli urutan key.
function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function computeRequestHash(req) {
  return crypto
    .createHash("sha256")
    .update(req.method + req.baseUrl + req.path + canonicalJson(req.body))
    .digest("hex");
}

module.exports = { computeRequestHash, canonicalJson };