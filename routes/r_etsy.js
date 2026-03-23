const express = require("express");
const axios = require("axios");
const { EtsyShopInfo } = require("../model/etsyShopInfo");
const { EtsyShopDaily } = require("../model/etsyShopDaily");
const { authenticateApiKey, countApiProxyLoad } = require("../controller/apiKeyAuth");

let autoTrackTimer = null;
let isAutoTrackingRunning = false;

/**
 * Etsy Shop Info API
 * Gets daily shop statistics from Etsy API v3
 * 
 * Environment Variables Required:
 * - ETSY_API_KEY: Your Etsy API key from https://www.etsy.com/developers
 * 
 * Returns:
 * - transaction_sold_count: Total number of sales
 * - review_count: Number of reviews
 * - num_favorers: Number of people who favorited the shop
 */

const router = express.Router();

function etsyHeaders() {
  return { "x-api-key": `${process.env.ETSY_API_KEY}:${process.env.ETSY_SECRET}` };
}

function getAutoTrackSchedule() {
    const hour = Number.parseInt(process.env.ETSY_AUTO_TRACK_HOUR || "1", 10);
    const minute = Number.parseInt(process.env.ETSY_AUTO_TRACK_MINUTE || "0", 10);
    const safeHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 1;
    const safeMinute = Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 0;
    return { hour: safeHour, minute: safeMinute };
}

function getDelayUntilNextRun(hour, minute) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
}

// Service function to fetch shop info from Etsy API
async function getEtsyShopInfo(shopId) {
    const apiKey = process.env.ETSY_API_KEY;
    const apiSecret = process.env.ETSY_SECRET;

    if (!apiKey) {
        throw new Error("ETSY_API_KEY is not configured");
    }
    if (!apiSecret) {
        throw new Error("ETSY_SECRET is not configured");
    }

    const apiUrl = `https://openapi.etsy.com/v3/application/shops/${shopId}`;

    const response = await axios.get(apiUrl, {
        headers: {
            "x-api-key": `${apiKey}:${apiSecret}`
            
        }
    });

    const shopData = response.data;

    return {
        shop_id: shopData.shop_id,
        shop_name: shopData.shop_name,
        icon_url_fullxfull: shopData.icon_url_fullxfull,
        transaction_sold_count: shopData.transaction_sold_count,
        review_count: shopData.review_count,
        num_favorers: shopData.num_favorers,
        listing_active_count: shopData.listing_active_count,
        created_timestamp: shopData.created_timestamp,
        url: shopData.url
    };
}

// Service function to search shop by name and get shop_id + full info
async function getShopInfoByName(shopName) {
    const apiKey = process.env.ETSY_API_KEY;
    const apiSecret = process.env.ETSY_SECRET;

    if (!apiKey) {
        throw new Error("ETSY_API_KEY is not configured");
    }
    if (!apiSecret) {
        throw new Error("ETSY_SECRET is not configured");
    }

    const searchUrl = `https://openapi.etsy.com/v3/application/shops?shop_name=${encodeURIComponent(shopName)}`;

    const searchResponse = await axios.get(searchUrl, {
        headers: {
            "x-api-key": `${apiKey}:${apiSecret}`
        }
    });

    console.log("Search Response:", JSON.stringify(searchResponse.data, null, 2));

    const shops = searchResponse.data?.results || [];

    if (shops.length === 0) {
        throw new Error(`No shop found with name: ${shopName}`);
    }

    // Get detailed info for the first matching shop
    const shop = shops[0];
    const detailUrl = `https://openapi.etsy.com/v3/application/shops/${shop.shop_id}`;

    const detailResponse = await axios.get(detailUrl, {
        headers: {
            "x-api-key": `${apiKey}:${apiSecret}`
        }
    });

    const shopData = detailResponse.data;

    return {
        shop_id: shopData.shop_id,
        shop_name: shopData.shop_name,
        icon_url_fullxfull: shopData.icon_url_fullxfull,
        transaction_sold_count: shopData.transaction_sold_count,
        review_count: shopData.review_count,
        num_favorers: shopData.num_favorers,
        listing_active_count: shopData.listing_active_count,
        created_timestamp: shopData.created_timestamp,
        url: shopData.url
    };
}

// Persist or update latest Etsy shop info
async function upsertEtsyShopInfo(data, delta = null) {
    try {
        if (!data || !data.shop_id) return;
        await EtsyShopInfo.findOneAndUpdate(
            { shop_id: data.shop_id },
            {
                ...data,
                delta: delta || null,
                last_fetched_at: new Date()
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (err) {
        console.error("Persist Etsy shop info error:", err.message);
    }
}

function getDateStrUTC(dateObj) {
    return dateObj.toISOString().slice(0, 10); // YYYY-MM-DD
}

function buildDeltaFromBaseline(currentData, baseline) {
    if (!baseline) return null;
    return {
        transaction_sold_count: (currentData.transaction_sold_count || 0) - (baseline.transaction_sold_count || 0),
        review_count: (currentData.review_count || 0) - (baseline.review_count || 0),
        num_favorers: (currentData.num_favorers || 0) - (baseline.num_favorers || 0),
    };
}

async function upsertDailySnapshot(data) {
    if (!data || !data.shop_id) return;
    const today = getDateStrUTC(new Date());
    try {
        await EtsyShopDaily.findOneAndUpdate(
            { shop_id: data.shop_id, date: today },
            {
                shop_id: data.shop_id,
                shop_name: data.shop_name,
                transaction_sold_count: data.transaction_sold_count,
                review_count: data.review_count,
                num_favorers: data.num_favorers,
                created_timestamp: data.created_timestamp,
                url: data.url,
                last_fetched_at: new Date(),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (err) {
        console.error("Persist daily Etsy shop snapshot error:", err.message);
    }
}

async function computeDelta(shopId, currentData, previousSavedShopInfo = null) {
    if (!shopId) return null;
    const today = getDateStrUTC(new Date());
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yDate = getDateStrUTC(yesterday);

    const yesterdaySnap = await EtsyShopDaily.findOne({ shop_id: shopId, date: yDate })
        .sort({ last_fetched_at: -1 }) // pick the most recent call from yesterday
        .lean();

    // Preferred baseline: yesterday snapshot
    const byYesterday = buildDeltaFromBaseline(currentData, yesterdaySnap);
    if (byYesterday) return byYesterday;

    // Fallback 1: latest snapshot before today (works even if last track was many days ago)
    const latestPreviousSnap = await EtsyShopDaily.findOne({
        shop_id: shopId,
        date: { $lt: today },
    })
        .sort({ date: -1, last_fetched_at: -1 })
        .lean();
    const byLatestPreviousDay = buildDeltaFromBaseline(currentData, latestPreviousSnap);
    if (byLatestPreviousDay) return byLatestPreviousDay;

    // Fallback 2: previous persisted shop info (for shops tracked before daily snapshots existed)
    const byPreviousSavedInfo = buildDeltaFromBaseline(currentData, previousSavedShopInfo);
    if (byPreviousSavedInfo) return byPreviousSavedInfo;

    return null;
}

async function runAutoTrackOnce() {
    if (isAutoTrackingRunning) {
        console.log("[Etsy Auto Track] Skip run because previous run is still processing.");
        return;
    }

    isAutoTrackingRunning = true;
    try {
        const shops = await EtsyShopInfo.find({}, { _id: 0, shop_id: 1 }).lean();
        if (!Array.isArray(shops) || shops.length === 0) {
            console.log("[Etsy Auto Track] No saved shops to process.");
            return;
        }

        let successCount = 0;
        let failCount = 0;
        for (const item of shops) {
            const shopId = item.shop_id;
            if (!shopId) continue;

            try {
                const result = await getEtsyShopInfo(shopId);
                const previousSavedShopInfo = await EtsyShopInfo.findOne({ shop_id: result.shop_id }).lean();
                const delta = await computeDelta(result.shop_id, result, previousSavedShopInfo);
                await upsertEtsyShopInfo(result, delta);
                await upsertDailySnapshot(result);
                successCount += 1;
            } catch (shopErr) {
                failCount += 1;
                console.error(`[Etsy Auto Track] Shop ${shopId} failed:`, shopErr.message);
            }
        }

        console.log(`[Etsy Auto Track] Completed. Success: ${successCount}, Failed: ${failCount}`);
    } catch (err) {
        console.error("[Etsy Auto Track] Run failed:", err.message);
    } finally {
        isAutoTrackingRunning = false;
    }
}

function scheduleNextAutoTrackRun() {
    const { hour, minute } = getAutoTrackSchedule();
    const delay = getDelayUntilNextRun(hour, minute);

    if (autoTrackTimer) {
        clearTimeout(autoTrackTimer);
    }

    autoTrackTimer = setTimeout(async () => {
        await runAutoTrackOnce();
        scheduleNextAutoTrackRun();
    }, delay);

    const nextRunAt = new Date(Date.now() + delay);
    console.log(`[Etsy Auto Track] Next run at ${nextRunAt.toISOString()} (local ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}).`);
}

function startEtsyAutoTracking() {
    const enabled = (process.env.ETSY_AUTO_TRACK_ENABLED || "true").toLowerCase() === "true";
    if (!enabled) {
        console.log("[Etsy Auto Track] Disabled by ETSY_AUTO_TRACK_ENABLED.");
        return;
    }

    if (autoTrackTimer) {
        console.log("[Etsy Auto Track] Scheduler already started.");
        return;
    }

    scheduleNextAutoTrackRun();

    const runOnStartup = (process.env.ETSY_AUTO_TRACK_RUN_ON_STARTUP || "false").toLowerCase() === "true";
    if (runOnStartup) {
        runAutoTrackOnce();
    }
}

// API endpoint
router.get("/etsy/shop/:shopId", async (req, res) => {
    try {
        const { shopId } = req.params;

        if (!shopId || shopId.trim() === "") {
            return res.status(400).json({ error: "Shop ID is required" });
        }

        const result = await getEtsyShopInfo(shopId);
        const previousSavedShopInfo = await EtsyShopInfo.findOne({ shop_id: result.shop_id }).lean();
        const delta = await computeDelta(result.shop_id, result, previousSavedShopInfo);
        await upsertEtsyShopInfo(result, delta);
        await upsertDailySnapshot(result);

        res.json({
            success: true,
            data: { ...result, delta },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Etsy API Error:", error.message);
        
        if (error.response) {
            return res.status(error.response.status).json({
                error: error.response.data?.error || "Failed to fetch shop info",
                details: error.response.data
            });
        }

        res.status(500).json({
            error: error.message || "Internal server error"
        });
    }
});

// Alternative POST endpoint for more flexibility
router.post("/etsy/shop", async (req, res) => {
    try {
        const { shop_id, shopId } = req.body;
        const id = shop_id || shopId;

        if (!id || id.toString().trim() === "") {
            return res.status(400).json({ error: "shop_id is required in request body" });
        }

        const result = await getEtsyShopInfo(id);
        const previousSavedShopInfo = await EtsyShopInfo.findOne({ shop_id: result.shop_id }).lean();
        const delta = await computeDelta(result.shop_id, result, previousSavedShopInfo);
        await upsertEtsyShopInfo(result, delta);
        await upsertDailySnapshot(result);

        res.json({
            success: true,
            data: { ...result, delta },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Etsy API Error:", error.message);
        
        if (error.response) {
            return res.status(error.response.status).json({
                error: error.response.data?.error || "Failed to fetch shop info",
                details: error.response.data
            });
        }

        res.status(500).json({
            error: error.message || "Internal server error"
        });
    }
});

// GET endpoint to search shop by name
router.get("/etsy/shop-search/:shopName", async (req, res) => {
    try {
        const { shopName } = req.params;

        if (!shopName || shopName.trim() === "") {
            return res.status(400).json({ error: "Shop name is required" });
        }

        const result = await getShopInfoByName(shopName);
        const previousSavedShopInfo = await EtsyShopInfo.findOne({ shop_id: result.shop_id }).lean();
        const delta = await computeDelta(result.shop_id, result, previousSavedShopInfo);
        await upsertEtsyShopInfo(result, delta);
        await upsertDailySnapshot(result);

        res.json({
            success: true,
            data: { ...result, delta },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Etsy API Error:", error.message);
        
        if (error.response) {
            return res.status(error.response.status).json({
                error: error.response.data?.error || "Failed to search shop",
                details: error.response.data
            });
        }

        res.status(500).json({
            error: error.message || "Internal server error"
        });
    }
});

// POST endpoint to search shop by name (alternative)
router.post("/etsy/shop-search", async (req, res) => {
    try {
        const { shop_name, shopName } = req.body;
        const name = shop_name || shopName;

        if (!name || name.trim() === "") {
            return res.status(400).json({ error: "shop_name is required in request body" });
        }

        const result = await getShopInfoByName(name);
        const previousSavedShopInfo = await EtsyShopInfo.findOne({ shop_id: result.shop_id }).lean();
        const delta = await computeDelta(result.shop_id, result, previousSavedShopInfo);
        await upsertEtsyShopInfo(result, delta);
        await upsertDailySnapshot(result);

        res.json({
            success: true,
            data: { ...result, delta },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Etsy API Error:", error.message);
        
        if (error.response) {
            return res.status(error.response.status).json({
                error: error.response.data?.error || "Failed to search shop",
                details: error.response.data
            });
        }

        res.status(500).json({
            error: error.message || "Internal server error"
        });
    }
});

// DELETE endpoint to remove a saved shop from MongoDB
router.delete("/etsy/shop/:shopId", async (req, res) => {
    try {
        const { shopId } = req.params;
        if (!shopId || shopId.trim() === "") {
            return res.status(400).json({ success: false, error: "Shop ID is required" });
        }

        const deletedShop = await EtsyShopInfo.findOneAndDelete({ shop_id: shopId.trim() });
        const deletedDaily = await EtsyShopDaily.deleteMany({ shop_id: shopId.trim() });

        if (!deletedShop) {
            return res.status(404).json({ success: false, error: "Shop not found" });
        }

        res.json({
            success: true,
            data: {
                shop_id: shopId.trim(),
                deleted_daily_count: deletedDaily.deletedCount || 0,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Delete Etsy shop error:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to delete shop",
            details: error.message,
        });
    }
});

// GET endpoint to list saved shops from MongoDB
router.get("/etsy/shops", async (req, res) => {
    try {
        const shops = await EtsyShopInfo.find(
            {},
            {
                _id: 0,
                shop_id: 1,
                shop_name: 1,
                icon_url_fullxfull: 1,
                transaction_sold_count: 1,
                review_count: 1,
                num_favorers: 1,
                listing_active_count: 1,
                delta: 1,
                created_timestamp: 1,
                url: 1,
                last_fetched_at: 1,
            }
        )
            .sort({ last_fetched_at: -1 })
            .lean();

        res.json({
            success: true,
            data: shops,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("List Etsy shops error:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to list saved shops",
            details: error.message,
        });
    }
});
//#region ETSY PROXY
router.all("/etsy-proxy", (req, res) => {
    res.status(400).json({
        error: "Missing Etsy path",
        message: "Use /etsy-proxy/{etsy-path}, e.g. /etsy-proxy/v3/application/shops/{shop_id}",
    });
});

router.all("/etsy-proxy/*", authenticateApiKey, countApiProxyLoad, async (req, res) => {
  try {
    const etsyPath = req.params[0];
    const etsyUrl = `https://openapi.etsy.com/${etsyPath}`;
    const method = req.method.toLowerCase();

    const config = {
      method,
      url: etsyUrl,
      headers: { ...etsyHeaders(), "Content-Type": "application/json" },
      params: req.query,
      timeout: 60000,
    };  

    if (["post", "put", "patch"].includes(method) && req.body) {
      config.data = req.body;
    }

    const response = await axios(config);

        if (req.apiQuota) {
            res.setHeader("x-quota-limit", String(req.apiQuota.quota));
            res.setHeader("x-quota-used-today", String(req.apiQuota.usedToday));
            res.setHeader("x-quota-remaining", String(req.apiQuota.remaining));
        }

    res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    res.status(status).json(data);
  }
});
//#endregion

module.exports = router;
module.exports.startEtsyAutoTracking = startEtsyAutoTracking;
