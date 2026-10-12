const XenditAdapter = require("./xendit.adapter");

class QrisAdapter extends XenditAdapter {
  constructor() { super({ provider: "qris" }); }
}

module.exports = QrisAdapter;