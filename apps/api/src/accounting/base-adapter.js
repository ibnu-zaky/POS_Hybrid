"use strict";

class AccountingAdapter {
  async pushJournal() { throw new Error("pushJournal is not implemented"); }
  async testConnection() { throw new Error("testConnection is not implemented"); }
}

module.exports = AccountingAdapter;
