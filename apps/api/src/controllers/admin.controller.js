const argon2 = require("argon2");
const staffRepository = require("../repositories/staff.repository");
const merchantRepository = require("../repositories/merchant.repository");
const apikeyService = require("../services/apikey.service");
const paymentService = require("../services/payment.service");
const {
  createStaffSchema, updateStaffSchema, updateMerchantSchema, createApiKeySchema,
} = require("../schemas/admin.schema");

function db(request) { return request.db; }
function tenant(request) { return request.auth.merchant_id; }

async function listStaff(request, response, next) {
  try { response.json({ data: await staffRepository.findAll(db(request), tenant(request)) }); } catch (error) { next(error); }
}

async function createStaff(request, response, next) {
  try {
    const body = createStaffSchema.parse(request.body);
    const passwordHash = await argon2.hash(body.password);
    const staff = await staffRepository.create(db(request), { merchantId: tenant(request), ...body, passwordHash });
    response.status(201).json({ data: staff });
  } catch (error) { next(error); }
}

async function updateStaff(request, response, next) {
  try {
    const body = updateStaffSchema.parse(request.body);
    const staff = await staffRepository.update(db(request), { merchantId: tenant(request), staffId: request.params.id, ...body });
    if (!staff) return response.status(404).json({ error: "Staff not found" });
    response.json({ data: staff });
  } catch (error) { next(error); }
}

async function deleteStaff(request, response, next) {
  try {
    const staff = await staffRepository.deactivate(db(request), tenant(request), request.params.id);
    if (!staff) return response.status(404).json({ error: "Staff not found" });
    response.json({ data: staff });
  } catch (error) { next(error); }
}

async function getMerchant(request, response, next) {
  try { response.json({ data: await merchantRepository.findById(db(request), tenant(request)) }); } catch (error) { next(error); }
}

async function updateMerchant(request, response, next) {
  try {
    const body = updateMerchantSchema.parse(request.body);
    const merchant = await merchantRepository.update(db(request), { merchantId: tenant(request), ...body });
    response.json({ data: merchant });
  } catch (error) { next(error); }
}

async function listApiKeys(request, response, next) {
  try { response.json({ data: await apikeyService.listApiKeys({ merchantId: tenant(request) }) }); } catch (error) { next(error); }
}

async function createApiKey(request, response, next) {
  try {
    const body = createApiKeySchema.parse(request.body);
    const key = await apikeyService.generateApiKey({ merchantId: tenant(request), staffId: request.auth.sub, name: body.name, expiresAt: body.expires_at });
    response.status(201).json({ data: key });
  } catch (error) { next(error); }
}

async function revokeApiKey(request, response, next) {
  try {
    const key = await apikeyService.revokeApiKey({ merchantId: tenant(request), keyId: request.params.id });
    if (!key) return response.status(404).json({ error: "API key not found" });
    response.json({ data: key });
  } catch (error) { next(error); }
}

async function reconcilePayments(request, response, next) {
  try {
    response.json({ data: await paymentService.reconcilePayments({ merchantId: tenant(request) }) });
  } catch (error) { next(error); }
}

async function retryPaymentWebhook(request, response, next) {
  try {
    response.json({ data: await paymentService.retryWebhook({ merchantId: tenant(request), eventId: request.params.id }) });
  } catch (error) { next(error); }
}

module.exports = {
  listStaff, createStaff, updateStaff, deleteStaff, getMerchant, updateMerchant,
  listApiKeys, createApiKey, revokeApiKey, reconcilePayments, retryPaymentWebhook,
};