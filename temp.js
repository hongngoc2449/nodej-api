const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const fetch = require("node-fetch");
const { shop } = require("../model/shop");
const { product, stock } = require("../model/warehouse");
const { Orders } = require("../model/oders");
const { Order_items } = require("../model/oder_items");
const StockManager = require("../controller/stockManager");

// với acc US
// https://partner.us.tiktokshop.com/approval/profile
// Với acc UK
// https://partner.tiktokshop.com/approval/profile

// for tiktok seller
// App develop ->seller inhouse developer -> tiktokshop seller

// url API: /add-tts-api-new
// url Webhook: /webhook-tiktok

// Manager api:
// "finace infomation" để get được tiền payout
// "global shop info" mơi get dc cipher.
// "order infomation" để get được thông tin order
// "Shop Authorized Information" để lấy được access token
// "Fulfillment Basic" create label

// #region API TIKTOK SHOP
function generateSha256(path, queries, secret) {
  const filteredQueries = {};
  Object.keys(queries).forEach((key) => {
    if (key !== "sign" && key !== "access_token") {
      filteredQueries[key] = queries[key];
    }
  });

  const sortedKeys = Object.keys(filteredQueries).sort();
  const concatenatedParams = sortedKeys
    .map((key) => key + filteredQueries[key])
    .join("");
  let inputStr = path + concatenatedParams;
  inputStr = secret + inputStr + secret;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(inputStr);
  const signature = hmac.digest("hex");

  return signature;
}
async function getOrderDetail(orderIds) {
  const jsonData = await fetch(
    "https://ff.stafaz.com/get-tts?shopName=Baby%20Stafaz"
  );

  const data_shop = await jsonData.json();
  const shopData = data_shop[0];

  const appKey = shopData.appKey;
  const appSecret = shopData.appSecret;
  const accessToken = shopData.access_token;
  const shopCipher = shopData.cipher;

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

async function getOrderList() {
  const jsonData = await fetch(
    "https://ff.stafaz.com/get-tts?shopName=Baby%20Stafaz"
  );

  const data_shop = await jsonData.json();
  const shopData = data_shop[0];

  const appKey = shopData.appKey;
  const appSecret = shopData.appSecret;
  const accessToken = shopData.access_token;
  const shopCipher = shopData.cipher;

  const startTime = "1640995200";
  const endTime = "1672531200";
  const pageSize = "50";

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/order/202309/orders/search";
    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
      version: "202309",
      start_time: startTime,
      end_time: endTime,
      page_size: pageSize,
    };

    const sign = generateSha256(path, queries, appSecret);
    console.log("sign: ", sign);
    console.log("queryParams: ", queries);
    const queryParams = new URLSearchParams({
      app_key: appKey,
      timestamp: timestamp.toString(),
      shop_cipher: shopCipher,
      version: "202309",
      startTime: startTime,
      endTime: endTime,
      orderStatus: "AWAITING_SHIPMENT",
      pageSize: pageSize,
      sign: sign,
    });
    console.log("queryParams: ", queryParams);
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
    console.log("data: ", data);
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

async function createPackage() {
  try {
    // Lấy thông tin shop từ API
    const jsonData = await fetch(
      "https://ff.stafaz.com/get-tts?shopName=Baby%20Stafaz"
    );

    if (!jsonData.ok) {
      throw new Error(`HTTP error! status: ${jsonData.status}`);
    }

    const data_shop = await jsonData.json();

    console.log("data_shop: ", data_shop);

    // API trả về array, cần lấy phần tử đầu tiên
    const shopData = data_shop[0];

    const appKey = shopData.appKey;
    const appSecret = shopData.appSecret;
    const accessToken = shopData.access_token; // Chú ý: tên field là access_token
    const shopCipher = shopData.cipher; // Chú ý: tên field là cipher

    console.log("appKey: ", appKey);
    console.log("appSecret: ", appSecret);
    console.log("accessToken: ", accessToken);
    console.log("shopCipher: ", shopCipher);

    // Kiểm tra các tham số bắt buộc
    if (!appKey || !appSecret || !accessToken || !shopCipher) {
      throw new Error("Thiếu thông tin shop từ API");
    }

    const orderId = "577120471396553479";
    const length = "0.3";
    const width = "0.3";
    const height = "10";
    const shippingServiceId = "7208502187360519982";
    const weight = "0.25";

    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/fulfillment/202309/packages";
    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
    };
    const sign = generateSha256(path, queries, appSecret);

    // Debug logging
    console.log("Create Package Debug:");
    console.log("Path:", path);
    console.log("Queries:", queries);
    console.log("Generated sign:", sign);

    const queryParams = new URLSearchParams({
      timestamp: timestamp.toString(),
      app_key: appKey,
      sign: sign,
      shop_cipher: shopCipher,
    });

    console.log("Query params:", queryParams);

    // Chuẩn bị body data
    const bodyData = {
      order_id: orderId,
      dimension: {
        length: length,
        width: width,
        height: height,
        unit: "in",
      },
      shipping_service_id: shippingServiceId,
      weight: {
        value: weight,
        unit: "lb",
      },
    };

    const fullUrl = `https://open-api.tiktokglobalshop.com${path}?${queryParams}`;
    console.log("Full URL:", fullUrl);
    console.log("Body data:", JSON.stringify(bodyData, null, 2));

    const response = await fetch(fullUrl, {
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
    console.log("Data:", data);
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

router.get("/order-detail", async (req, res) => {
  try {
    const orderIds = req.query.orderId;
    if (!orderIds) {
      return res.status(400).json({
        success: false,
        error: "orderId parameter is required",
      });
    }

    const result = await getOrderDetail(orderIds);
    res.json(result);
  } catch (error) {
    console.error("Order detail route error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

router.get("/order-list", async (req, res) => {
  try {
    const result = await getOrderList();
    res.json(result);
  } catch (error) {
    console.error("Order list route error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

router.get("/create-package", async (req, res) => {
  try {
    const result = await createPackage();
    res.json(result);
  } catch (error) {
    console.error("Create package route error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

// #endregion API TIKTOK SHOP

module.exports = {
  router,
  getOrderDetail,
  getOrderList,
  createPackage,
};
