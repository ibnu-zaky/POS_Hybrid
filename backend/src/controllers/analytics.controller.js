const analyticsService = require("../services/analytics.service");
const {
  salesByProductQuerySchema,
  marginQuerySchema,
  slowMovingQuerySchema,
  turnoverQuerySchema,
} = require("../schemas/analytics.schema");

function tenant(request) { return request.auth.merchant_id; }

async function salesByProduct(request, response, next) {
  try {
    const query = salesByProductQuerySchema.parse(request.query);
    const result = await analyticsService.getSalesByProduct({
      merchantId: tenant(request),
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
    response.json({ period: result.period, data: result.data });
  } catch (error) { next(error); }
}

async function margin(request, response, next) {
  try {
    const query = marginQuerySchema.parse(request.query);
    const result = await analyticsService.getMargin({
      merchantId: tenant(request),
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
    response.json({ period: result.period, data: result.data });
  } catch (error) { next(error); }
}

async function slowMoving(request, response, next) {
  try {
    const query = slowMovingQuerySchema.parse(request.query);
    const result = await analyticsService.getSlowMoving({
      merchantId: tenant(request),
      days: query.days,
      limit: query.limit,
    });
    response.json({ period: result.period, data: result.data });
  } catch (error) { next(error); }
}

async function turnover(request, response, next) {
  try {
    const query = turnoverQuerySchema.parse(request.query);
    const result = await analyticsService.getTurnover({
      merchantId: tenant(request),
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
    response.json({ period: result.period, note: result.note, data: result.data });
  } catch (error) { next(error); }
}

module.exports = {
  salesByProduct,
  margin,
  slowMoving,
  turnover,
};
