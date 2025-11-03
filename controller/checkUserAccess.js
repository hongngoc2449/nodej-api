const checkAuth = (req, res, next) => {
  // Simple permissive middleware for testing
  // Allow optional token gate via header x-api-key that must match env API_KEY if provided
  const requiredKey = process.env.API_KEY;
  const providedKey = req.headers["x-api-key"];
  if (requiredKey && providedKey !== requiredKey) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
};

module.exports = { checkAuth };
