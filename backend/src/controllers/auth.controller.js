const { loginSchema, tenantIdSchema } = require("../schemas/auth.schema");
const authService = require("../services/auth.service");

async function login(request, response, next) {
  try {
    const body = loginSchema.parse(request.body);
    const tenantHeader = request.get("X-Tenant-ID");
    const merchantId = tenantIdSchema.parse(tenantHeader);

    const result = await authService.login({
      email: body.email,
      password: body.password,
      deviceId: body.device_id,
      merchantId,
      ipAddress: request.ip,
      userAgent: request.get("User-Agent"),
    });

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function devLogin(request, response, next) {
  try {
    const body = loginSchema.parse(request.body);
    const tenantHeader = request.get("X-Tenant-ID");
    const merchantId = tenantIdSchema.parse(tenantHeader);

    const result = await authService.loginDev({
      email: body.email,
      password: body.password,
      deviceId: body.device_id,
      merchantId,
      ipAddress: request.ip,
      userAgent: request.get("User-Agent"),
    });

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function refresh(request, response, next) {
  try {
    const refreshToken = typeof request.body?.refresh_token === "string"
      ? request.body.refresh_token
      : null;

    if (!refreshToken) {
      return response.status(400).json({ error: "Refresh token is required" });
    }

    const result = await authService.refreshSession({
      refreshToken,
      ipAddress: request.ip,
      userAgent: request.get("User-Agent"),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function logout(request, response, next) {
  try {
    const refreshToken = typeof request.body?.refresh_token === "string"
      ? request.body.refresh_token
      : null;

    const result = await authService.logout({
      userId: request.auth?.sub,
      merchantId: request.auth?.merchant_id,
      refreshToken,
      ipAddress: request.ip,
      userAgent: request.get("User-Agent"),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function me(request, response, next) {
  try {
    const { sub: staffId, merchant_id: merchantId, role } = request.auth;

    const [staffResult, merchantResult] = await Promise.all([
      request.db.query(
        `SELECT id, merchant_id, email, name, role, is_active
         FROM staff
         WHERE id = $1 AND merchant_id = $2
         LIMIT 1`,
        [staffId, merchantId],
      ),
      request.db.query(
        `SELECT id, name, email, status, subscription_tier
         FROM merchants
         WHERE id = $1
         LIMIT 1`,
        [merchantId],
      ),
    ]);

    const staff = staffResult.rows[0];
    const merchant = merchantResult.rows[0];

    if (!staff || !merchant) {
      return response.status(404).json({ error: "Staff or merchant not found" });
    }

    return response.status(200).json({
      staff: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        is_active: staff.is_active,
      },
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        status: merchant.status,
        subscription_tier: merchant.subscription_tier,
      },
      auth: {
        merchant_id: merchantId,
        role,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  devLogin,
  refresh,
  logout,
  me,
};
