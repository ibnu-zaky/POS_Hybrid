"use strict";

const AccountingAdapter = require("./base-adapter");

class DummyAccountingAdapter extends AccountingAdapter {
  constructor(config = {}) {
    super();
    this.companyId = config.company_id || "dummy-company";
    this.pushed = [];
  }

  async pushJournal(entry) {
    this.pushed.push(entry);
    return {
      success: true,
      provider: "dummy",
      external_id: `dummy-journal-${entry.id}`,
      pushed_at: new Date().toISOString(),
    };
  }

  async testConnection() {
    return { success: true, provider: "dummy", company_id: this.companyId };
  }
}

module.exports = DummyAccountingAdapter;
