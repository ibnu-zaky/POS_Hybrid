const { withTenantContext } = require("../config/database");

function requirePermission(permissionCode) {
  return async (request, response, next) => {
    if (!request.auth || typeof request.auth.role !== "string" || !request.auth.merchant_id) {
      return response.status(401).json({ error: "Authentication required" });
    }

    const role = request.auth.role.toLowerCase();
    const merchantId = request.auth.merchant_id;

    // Admin selalu punya semua izin
    if (role === "admin") {
      return next();
    }

    try {
      const hasPermission = await withTenantContext(merchantId, async (client) => {
        const res = await client.query(
          `SELECT 1 FROM role_permissions rp
           JOIN permissions p ON rp.permission_id = p.id
           WHERE rp.merchant_id = $1 AND LOWER(rp.role) = LOWER($2) AND p.code = $3
           LIMIT 1`,
          [merchantId, role, permissionCode]
        );
        return (res.rowCount || 0) > 0;
      });

      if (!hasPermission) {
        return response.status(403).json({ error: "Forbidden: insufficient permissions" });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requirePermission;
