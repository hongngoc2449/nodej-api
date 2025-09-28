const crypto = require("crypto");
const fetch = require("node-fetch");

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

/**
 * Lấy thông tin chi tiết đơn hàng từ TikTok Shop API
 */
async function getOrderDetail(
  orderIds,
  appKey,
  appSecret,
  shopCipher,
  accessToken
) {
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
async function getOrderList(params) {
  const {
    appKey,
    appSecret,
    accessToken,
    shopCipher,
    startTime,
    endTime,
    orderStatus,
    deliveryOptionType,
    buyerUserId,
    pageSize = 20,
    cursor,
  } = params;

  try {
    if (
      !appKey ||
      !appSecret ||
      !accessToken ||
      !shopCipher ||
      !startTime ||
      !endTime
    ) {
      throw new Error(
        "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, startTime, endTime"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/order/202309/orders/search";
    // Tạo queries object với tất cả parameters
    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
      version: "202309",
      start_time: startTime,
      end_time: endTime,
      page_size: pageSize,
      ...(orderStatus && { order_status: orderStatus }),
      ...(deliveryOptionType && { delivery_option_type: deliveryOptionType }),
      ...(buyerUserId && { buyer_user_id: buyerUserId }),
      ...(cursor && { cursor: cursor }),
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
 * Tạo package (shipping label) cho đơn hàng TikTok Shop
 */
async function createPackage(params) {
  const {
    appKey,
    appSecret,
    accessToken,
    shopCipher,
    orderId,
    dimension,
    weight,
    shippingServiceId,
  } = params;

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
  const {
    appKey,
    appSecret,
    accessToken,
    shopCipher,
    packageId,
    documentType = "SHIPPING_LABEL_PDF",
    documentSize, // optional per docs
    documentFormat, // optional per docs
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

module.exports = {
  getOrderDetail,
  getOrderList,
  generateSha256,
  createPackage,
  getShipLabel,
};
