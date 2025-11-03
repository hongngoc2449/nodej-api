const crypto = require("crypto");
const fetch = require("node-fetch");
const express = require("express");
const router = express.Router();

// Helper function để tạo signature SHA256
function generateSha256(path, queries, secret, body = null) {
  // Step 1: Extract all query parameters excluding sign and access_token
  const filteredQueries = Object.keys(queries)
    .filter((key) => key !== "sign" && key !== "access_token")
    .sort()
    .reduce((acc, key) => ({ ...acc, [key]: queries[key] }), {});

  // Step 2: Concatenate all the parameters in the format {key}{value}
  const concatenatedParams = Object.keys(filteredQueries)
    .map((key) => key + filteredQueries[key])
    .join("");

  // Step 3: Append the string from Step 2 to the API request path
  let signString = path + concatenatedParams;

  // Step 4: If request has body, append the API request body to the string
  if (body && Object.keys(body).length > 0) {
    const bodyString = JSON.stringify(body);
    signString += bodyString;
  }

  // Step 5: Wrap the string with the app_secret
  signString = secret + signString + secret;

  // Step 6: Encode using HMAC-SHA256
  return crypto.createHmac("sha256", secret).update(signString).digest("hex");
}

async function getShopData(shopName = "Baby%20Stafaz") {
  const jsonData = await fetch(
    "https://ff.stafaz.com/get-tts?shopName=" + shopName
  );
  const data_shop = await jsonData.json();
  const shopData = data_shop[0];

  const appKey = shopData.appKey;
  const appSecret = shopData.appSecret;
  const accessToken = shopData.access_token;
  const shopCipher = shopData.cipher;

  return { appKey, appSecret, shopCipher, accessToken };
}

/**
 * Lấy thông tin chi tiết đơn hàng từ TikTok Shop API
 */
async function getOrderDetail(orderIds, shopName = "Baby%20Stafaz") {
  const { appKey, appSecret, shopCipher, accessToken } = await getShopData(
    shopName
  );
  try {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    if (ids.length > 50)
      throw new Error("Maximum 50 order IDs allowed per request");

    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/order/202507/orders";
    const queries = {
      app_key: appKey,
      timestamp,
      ids: ids.join(","),
      shop_cipher: shopCipher,
      version: "202507",
    };

    const sign = generateSha256(path, queries, appSecret);
    const queryParams = new URLSearchParams({
      sign,
      shop_cipher: shopCipher,
      ids: ids.join(","),
      timestamp: timestamp.toString(),
      app_key: appKey,
      version: "202507",
    });

    const response = await fetch(
      `https://open-api.tiktokglobalshop.com${path}?${queryParams}`,
      {
        method: "GET",
        headers: {
          "content-type": "application/json",
          "x-tts-access-token": accessToken,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(
        `API error: ${data.message || "Unknown error"}, code: ${data.code}`
      );
    }

    return {
      success: true,
      data: data.data,
      request_id: data.request_id,
      code: data.code,
      message: data.message,
    };
  } catch (error) {
    console.error("Error fetching order details:", error);
    return { success: false, error: error.message, data: null };
  }
}

/**
 * Lấy danh sách đơn hàng từ TikTok Shop API
 */
async function getOrderList(
  shopName = "Baby%20Stafaz",
  order_status = "AWAITING_SHIPMENT",
  page_token = null,
  page_size = 20
) {
  const { appKey, appSecret, shopCipher, accessToken } = await getShopData(
    shopName
  );

  try {
    if (!appKey || !appSecret || !accessToken || !shopCipher || !order_status) {
      throw new Error(
        "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, order_status"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/order/202309/orders/search";
    // Tạo queries object với tất cả parameters
    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
      page_size: page_size,
      order_status: order_status,
      ...(page_token && { page_token: page_token }),
    };

    const sign = generateSha256(path, queries, appSecret);

    // Tạo queryParams từ queries object
    const queryParams = new URLSearchParams();
    Object.entries(queries).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
    queryParams.append("sign", sign);

    const response = await fetch(
      `https://open-api.tiktokglobalshop.com${path}?${queryParams}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tts-access-token": accessToken,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(
        `API error: ${data.message || "Unknown error"}, code: ${data.code}`
      );
    }

    return {
      success: true,
      data: data.data,
      request_id: data.request_id,
      code: data.code,
      message: data.message,
    };
  } catch (error) {
    console.error("Error fetching order list:", error);
    return { success: false, error: error.message, data: null };
  }
}

/**
 * Lấy danh sách finance statements từ TikTok Shop API
 * Yêu cầu tối thiểu các query: app_key, sort_field(statement_time), sign, timestamp, shop_cipher
 */
async function getStatement(
  shopName = "Baby%20Stafaz",
  { sort_field = "statement_time", page_size, page_token } = {}
) {
  const { appKey, appSecret, shopCipher, accessToken } = await getShopData(
    shopName
  );

  try {
    if (!appKey || !appSecret || !accessToken || !shopCipher) {
      throw new Error(
        "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/finance/202309/statements";

    // Tạo queries object với các tham số yêu cầu
    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
      sort_field,
    };

    if (page_size) queries.page_size = page_size;
    if (page_token) queries.page_token = page_token;

    const sign = generateSha256(path, queries, appSecret);

    // Tạo query params
    const queryParams = new URLSearchParams();
    Object.entries(queries).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
    queryParams.append("sign", sign);

    const url = `https://open-api.tiktokglobalshop.com${path}?${queryParams}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(
        `API error: ${data.message || "Unknown error"}, code: ${data.code}`
      );
    }

    return {
      success: true,
      data: data.data,
      request_id: data.request_id,
      code: data.code,
      message: data.message,
    };
  } catch (error) {
    console.error("Error fetching finance statements:", error);
    return { success: false, error: error.message, data: null };
  }
}

/**
 * Tạo package (shipping label) cho đơn hàng TikTok Shop
 */
async function createPackage(params) {
  const { appKey, appSecret, shopCipher, accessToken } = await getShopData();
  const { orderId, dimension, weight, shippingServiceId } = params;

  try {
    if (!appKey || !appSecret || !accessToken || !shopCipher || !orderId) {
      throw new Error(
        "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, orderId"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/fulfillment/202309/packages";

    // Tạo queries object cho signature
    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
      version: "202309",
    };

    // Chuẩn bị body data trước
    const bodyData = {
      order_id: orderId,
    };

    if (dimension) {
      bodyData.dimension = dimension;
    }

    if (weight) {
      bodyData.weight = weight;
    }

    if (shippingServiceId) {
      bodyData.shipping_service_id = shippingServiceId;
    }

    // Tạo signature với body data
    const sign = generateSha256(path, queries, appSecret, bodyData);
    console.log("Generated signature:", sign);

    // Tạo queryParams từ queries object
    const queryParams = new URLSearchParams();
    Object.entries(queries).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
    queryParams.append("sign", sign);

    const url = `https://open-api.tiktokglobalshop.com${path}?${queryParams}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(
        `API error: ${data.message || "Unknown error"}, code: ${data.code}`
      );
    }

    return {
      success: true,
      data: data.data,
      request_id: data.request_id,
      code: data.code,
      message: data.message,
    };
  } catch (error) {
    console.error("Error creating package:", error);
    return { success: false, error: error.message, data: null };
  }
}

/**
 * Lấy thông tin shipping label từ TikTok Shop API
 */
async function getShipLabel(params) {
  const { appKey, appSecret, shopCipher, accessToken } = await getShopData();
  const {
    packageId,
    documentType = "SHIPPING_LABEL",
    documentSize,
    documentFormat,
  } = params;

  try {
    if (!appKey || !appSecret || !accessToken || !shopCipher || !packageId) {
      throw new Error(
        "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, packageId"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    // package_id is part of path per docs
    const path = `/fulfillment/202309/packages/${packageId}/shipping_documents`;

    // Tạo queries object cho signature (query params)
    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
      version: "202309",
      document_type: documentType,
    };

    if (documentSize) queries.document_size = documentSize;
    if (documentFormat) queries.document_format = documentFormat;

    // Tạo signature (không có body cho GET request)
    const sign = generateSha256(path, queries, appSecret);
    console.log("Generated signature:", sign);

    // Tạo queryParams từ queries object
    const queryParams = new URLSearchParams();
    Object.entries(queries).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
    queryParams.append("sign", sign);

    const url = `https://open-api.tiktokglobalshop.com${path}?${queryParams}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(
        `API error: ${data.message || "Unknown error"}, code: ${data.code}`
      );
    }

    return {
      success: true,
      data: data.data,
      request_id: data.request_id,
      code: data.code,
      message: data.message,
    };
  } catch (error) {
    console.error("Error getting ship label:", error);
    return { success: false, error: error.message, data: null };
  }
}

/**
 * Lấy thông tin tracking của đơn hàng từ TikTok Shop API
 * Required: order_id và các query parameters: app_key, sign, timestamp, shop_cipher
 */
async function getOrderTracking(orderId, shopName = "Baby%20Stafaz") {
  const { appKey, appSecret, shopCipher, accessToken } = await getShopData(
    shopName
  );

  try {
    if (!appKey || !appSecret || !accessToken || !shopCipher || !orderId) {
      throw new Error(
        "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, orderId"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const path = `/fulfillment/202309/orders/${orderId}/tracking`;

    // Tạo queries object với các tham số yêu cầu
    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
    };

    const sign = generateSha256(path, queries, appSecret);

    // Tạo query params
    const queryParams = new URLSearchParams();
    Object.entries(queries).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
    queryParams.append("sign", sign);

    const url = `https://open-api.tiktokglobalshop.com${path}?${queryParams}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(
        `API error: ${data.message || "Unknown error"}, code: ${data.code}`
      );
    }

    return {
      success: true,
      data: data.data,
      request_id: data.request_id,
      code: data.code,
      message: data.message,
    };
  } catch (error) {
    console.error("Error fetching order tracking:", error);
    return { success: false, error: error.message, data: null };
  }
}

/**
 * Đánh dấu package là đã gửi (Mark Package As Shipped)
 * Dùng cho hình thức tự vận chuyển: cần shipping_provider_id, tracking_number, và order_line_item_ids.
 */
async function markPackAsShip(params) {
  const { appKey, appSecret, shopCipher, accessToken } = await getShopData();
  const { orderId, trackingNumber, shippingProviderId } = params;

  try {
    if (
      !appKey ||
      !appSecret ||
      !accessToken ||
      !shopCipher ||
      !orderId ||
      !shippingProviderId ||
      !trackingNumber
    ) {
      throw new Error(
        "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, orderId, shippingProviderId, trackingNumber"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    // Path theo spec: /fulfillment/202309/orders/{order_id}/packages
    const path = `/fulfillment/202309/orders/${orderId}/packages`;

    // Query parameters theo spec
    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
    };

    // Body parameters theo spec
    const bodyData = {
      tracking_number: trackingNumber,
      shipping_provider_id: shippingProviderId,
    };

    const sign = generateSha256(path, queries, appSecret, bodyData);

    const queryParams = new URLSearchParams();
    Object.entries(queries).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
    queryParams.append("sign", sign);

    const url = `https://open-api.tiktokglobalshop.com${path}?${queryParams}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(
        `API error: ${data.message || "Unknown error"}, code: ${data.code}`
      );
    }

    return {
      success: true,
      data: data.data,
      request_id: data.request_id,
      code: data.code,
      message: data.message,
    };
  } catch (error) {
    console.error("Error marking package as shipped:", error);
    return { success: false, error: error.message, data: null };
  }
}

// Order detail endpoint
//http://localhost:3000/order-detail?orderIds=1234567890
router.get("/order-detail", async (req, res) => {
  try {
    const { orderIds } = req.query;

    if (!orderIds) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc: orderIds, appKey, appSecret, shopCipher và x-tts-access-token header",
      });
    }

    const result = await getOrderDetail(orderIds);

    if (result.success) {
      res.json({
        success: true,
        message: "Lấy thông tin đơn hàng thành công",
        ...result,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Order detail route error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// Order list endpoint
//http://localhost:3000/order-list?shopName=Baby%20Stafaz&order_status=AWAITING_SHIPMENT
router.get("/order-list", async (req, res) => {
  try {
    const {
      shopName = "Baby%20Stafaz",
      order_status = "AWAITING_SHIPMENT",
      page_token = null,
      page_size = 20,
    } = req.query;
    const result = await getOrderList(
      shopName,
      order_status,
      page_token,
      parseInt(page_size)
    );

    if (result.success) {
      res.json({
        success: true,
        message: "Lấy danh sách đơn hàng thành công",
        ...result,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Order list route error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// Finance statements endpoint
// Ví dụ: GET /finance-statements?shopName=Baby%20Stafaz&sort_field=statement_time&page_size=20
router.get("/finance-statements", async (req, res) => {
  try {
    const {
      shopName = "Baby%20Stafaz",
      sort_field = "statement_time",
      page_size,
      page_token,
    } = req.query;
    const result = await getStatement(shopName, {
      sort_field,
      page_size: page_size ? parseInt(page_size) : undefined,
      page_token,
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Lấy finance statements thành công",
        ...result,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Finance statements route error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// Order tracking endpoint
// Ví dụ: GET /order-tracking?orderId=1234567890&shopName=Baby%20Stafaz
router.get("/order-tracking", async (req, res) => {
  try {
    const { orderId, shopName = "Baby%20Stafaz" } = req.query;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Thiếu tham số bắt buộc: orderId",
      });
    }

    const result = await getOrderTracking(orderId, shopName);

    if (result.success) {
      res.json({
        success: true,
        message: "Lấy thông tin tracking đơn hàng thành công",
        ...result,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Order tracking route error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// Create package endpoint
router.post("/create-package", async (req, res) => {
  try {
    const {
      appKey,
      appSecret,
      shopCipher,
      orderId,
      dimension,
      weight,
      shippingServiceId,
    } = req.body;
    const accessToken = req.headers["x-tts-access-token"];

    if (!appKey || !appSecret || !accessToken || !shopCipher || !orderId) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, orderId",
      });
    }

    const result = await createPackage({
      appKey,
      appSecret,
      accessToken,
      shopCipher,
      orderId,
      dimension,
      weight,
      shippingServiceId,
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Tạo package thành công",
        ...result,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Create package route error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// Get ship label endpoint
router.get("/ship-label", async (req, res) => {
  try {
    const {
      appKey,
      appSecret,
      shopCipher,
      packageId,
      documentType,
      documentSize,
      documentFormat,
    } = req.query;
    const accessToken = req.headers["x-tts-access-token"];

    if (!appKey || !appSecret || !accessToken || !shopCipher || !packageId) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, packageId",
      });
    }

    const result = await getShipLabel({
      appKey,
      appSecret,
      accessToken,
      shopCipher,
      packageId,
      documentType,
      documentSize,
      documentFormat,
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Lấy thông tin shipping label thành công",
        ...result,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Get ship label route error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// Mark package as shipped endpoint
router.post("/mark-package-as-shipped", async (req, res) => {
  try {
    const {
      appKey,
      appSecret,
      shopCipher,
      orderId,
      shippingProviderId,
      trackingNumber,
    } = req.body;
    const accessToken = req.headers["x-tts-access-token"];

    if (
      !appKey ||
      !appSecret ||
      !accessToken ||
      !shopCipher ||
      !orderId ||
      !shippingProviderId ||
      !trackingNumber
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, orderId, shippingProviderId, trackingNumber",
      });
    }

    const result = await markPackAsShip({
      appKey,
      appSecret,
      accessToken,
      shopCipher,
      orderId,
      shippingProviderId,
      trackingNumber,
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Đánh dấu shipped thành công",
        ...result,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Mark package shipped route error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

module.exports = router;
