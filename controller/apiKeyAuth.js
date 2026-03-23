const { User } = require("../model/user");

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function extractApiKey(req) {
  const headerKey = req.headers["x-api-key"];
  if (headerKey) {
    return String(headerKey).trim();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
}

async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "Missing API key",
      });
    }

    const user = await User.findOne({ apiKey });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid API key",
      });
    }

    req.apiUser = user;
    next();
  } catch (error) {
    console.error("API key auth error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function countApiProxyLoad(req, res, next) {
  try {
    let apiUser = req.apiUser;
    if (!apiUser) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const today = getTodayDateString();

    if (apiUser.apiQuotaDate !== today) {
      apiUser = await User.findByIdAndUpdate(
        apiUser._id,
        {
          $set: {
            apiQuotaDate: today,
            dailyApiRequestCount: 0,
          },
        },
        { new: true }
      );
    }

    const quotaLimit = Number(apiUser?.quota || 0);
    const usedToday = Number(apiUser?.dailyApiRequestCount || 0);
    const remainingBeforeRequest = Math.max(0, quotaLimit - usedToday);

    if (remainingBeforeRequest <= 0) {
      return res.status(429).json({
        success: false,
        message: "Quota exceeded for today",
        quota: quotaLimit,
        usedToday,
        remaining: 0,
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      apiUser._id,
      {
        $inc: {
          apiRequestCount: 1,
          dailyApiRequestCount: 1,
        },
        $set: {
          lastApiRequestAt: new Date(),
          apiQuotaDate: today,
        },
      },
      { new: true }
    );

    if (updatedUser) {
      req.apiUser = updatedUser;
      req.apiQuota = {
        quota: quotaLimit,
        usedToday: updatedUser.dailyApiRequestCount || 0,
        remaining: Math.max(
          0,
          quotaLimit - (updatedUser.dailyApiRequestCount || 0)
        ),
      };
    }

    next();
  } catch (error) {
    console.error("API proxy count error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  authenticateApiKey,
  countApiProxyLoad,
  extractApiKey,
  getTodayDateString,
};
