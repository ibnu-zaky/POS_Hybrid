"use strict";

const DummyAccountingAdapter = require("./dummy-adapter");

const ADAPTERS = {
  dummy: DummyAccountingAdapter,
  xero: null,
  myob: null,
  quickbooks: null,
};

function getAdapter(provider, config = {}) {
  const AdapterClass = ADAPTERS[provider];
  if (!AdapterClass) {
    throw new Error(`Adapter untuk provider "${provider}" belum tersedia`);
  }
  return new AdapterClass(config);
}

module.exports = { getAdapter, ADAPTERS };
