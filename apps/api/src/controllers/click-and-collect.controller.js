"use strict";

const cncService = require("../services/click-and-collect.service");
const {
  createReservationSchema,
  listReservationsQuerySchema,
  verifyPickupSchema,
} = require("../schemas/click-and-collect.schema");

function tenant(request) { return request.auth.merchant_id; }
function staffId(request) { return request.auth.sub; }

async function createReservation(request, response, next) {
  try {
    const body = createReservationSchema.parse(request.body);
    const order = await cncService.createReservation({
      merchantId: tenant(request),
      staffId: staffId(request),
      payload: body,
    });
    response.status(201).json(order);
  } catch (error) { next(error); }
}

async function listReservations(request, response, next) {
  try {
    const query = listReservationsQuerySchema.parse(request.query);
    const data = await cncService.listReservations({ merchantId: tenant(request), ...query });
    response.json({ data });
  } catch (error) { next(error); }
}

async function getReservation(request, response, next) {
  try {
    const order = await cncService.getReservation({ merchantId: tenant(request), id: request.params.id });
    response.json(order);
  } catch (error) { next(error); }
}

async function verifyPickup(request, response, next) {
  try {
    const body = verifyPickupSchema.parse(request.body);
    const result = await cncService.verifyPickup({
      merchantId: tenant(request),
      staffId: staffId(request),
      pickup_code: body.pickup_code,
    });
    response.json(result);
  } catch (error) { next(error); }
}

async function cancelReservation(request, response, next) {
  try {
    const result = await cncService.cancelReservation({
      merchantId: tenant(request),
      staffId: staffId(request),
      id: request.params.id,
    });
    response.json(result);
  } catch (error) { next(error); }
}

async function expireReservations(request, response, next) {
  try {
    const result = await cncService.expireReservations({ merchantId: tenant(request) });
    response.json(result);
  } catch (error) { next(error); }
}

module.exports = {
  createReservation,
  listReservations,
  getReservation,
  verifyPickup,
  cancelReservation,
  expireReservations,
};
