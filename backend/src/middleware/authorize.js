function authorize(allowedRoles = []) {
  const roles = allowedRoles.map((role) => String(role).toLowerCase());

  return (request, response, next) => {
    if (!request.auth || typeof request.auth.role !== "string") {
      return response.status(401).json({ error: "Authentication required" });
    }

    const userRole = request.auth.role.toLowerCase();

    if (!roles.length) {
      return next();
    }

    if (!roles.includes(userRole)) {
      return response.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}

module.exports = authorize;
