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
  if (body !== null && body !== undefined) {
    const bodyString = typeof body === "string" ? body : JSON.stringify(body);
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
 * Search products from TikTok Shop API
 * Endpoint: POST /product/202309/products/search
 * Required headers: content-type: application/json, x-tts-access-token
 * Required query params for signing: app_key, timestamp, shop_cipher, page_size
 */
async function searchProducts(params) {
  const {
    appKey,
    appSecret,
    accessToken,
    shopCipher,
    page_size = 20,
    page_token,
    body,
  } = params || {};

  try {
    if (!appKey || !appSecret || !accessToken || !shopCipher) {
      throw new Error(
        "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/product/202309/products/search";

    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
      page_size: parseInt(page_size),
      ...(page_token && { page_token: page_token }),
    };

    const bodyData = body && typeof body === "object" ? body : {};

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
    console.error("Error searching products:", error);
    return { success: false, error: error.message, data: null };
  }
}

/**
 * Get single product detail from TikTok Shop API
 * Endpoint: GET /product/202309/products/{product_id}
 * Required headers: content-type: application/json, x-tts-access-token
 * Required query params for signing: app_key, timestamp, shop_cipher
 */
async function getProduct(params) {
  const {
    appKey: rawAppKey,
    appSecret: rawAppSecret,
    accessToken: rawAccessToken,
    shopCipher: rawShopCipher,
    product_id: rawProductId,
  } = params || {};

  const appKey = (rawAppKey || "").toString().trim();
  const appSecret = (rawAppSecret || "").toString().trim();
  const accessToken = (rawAccessToken || "").toString().trim();
  const shopCipher = (rawShopCipher || "").toString().trim();
  const product_id = (rawProductId || "").toString().trim();

  try {
    if (!appKey || !appSecret || !accessToken || !shopCipher || !product_id) {
      throw new Error(
        "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, product_id"
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const path = `/product/202309/products/${product_id}`;

    const queries = {
      app_key: appKey,
      timestamp,
      shop_cipher: shopCipher,
      version: "202309",
    };

    const sign = generateSha256(path, queries, appSecret);

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
    console.error("Error getting product:", error);
    return { success: false, error: error.message, data: null };
  }
}

function toNumber(value, defaultValue = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
}

function slugify(value = "") {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function collectImageUrls(rawImages) {
  if (!Array.isArray(rawImages)) return [];

  const urls = [];
  rawImages.forEach((image) => {
    if (!image) return;

    if (!Array.isArray(image.urls) || image.urls.length < 2) {
      return;
    }

    const firstUrl = image.urls[0];
    const secondUrl = image.urls[1];

    if (
      typeof secondUrl === "string" &&
      secondUrl.trim() &&
      secondUrl !== firstUrl
    ) {
      urls.push(secondUrl);
    }
  });

  return [...new Set(urls.filter(Boolean))];
}

function mapTikTokProductToJsonData(rawData) {
  const source = rawData?.product || rawData || {};
  const skuList = Array.isArray(source.skus)
    ? source.skus
    : Array.isArray(source.sku_list)
    ? source.sku_list
    : [];

  const optionMap = new Map();

  const variants = skuList.map((sku) => {
    const attributes = Array.isArray(sku?.sales_attributes)
      ? sku.sales_attributes
      : Array.isArray(sku?.sku_property_values)
      ? sku.sku_property_values
      : Array.isArray(sku?.properties)
      ? sku.properties
      : [];

    const normalizedAttrs = attributes
      .map((attr) => {
        const name =
          attr?.name ||
          attr?.attribute_name ||
          attr?.property_name ||
          attr?.property ||
          "";
        const value =
          attr?.value_name ||
          attr?.value ||
          attr?.attribute_value_name ||
          attr?.property_value ||
          "";

        return {
          name: name.toString().trim(),
          value: value.toString().trim(),
        };
      })
      .filter((item) => item.name && item.value);

    normalizedAttrs.forEach((item) => {
      if (!optionMap.has(item.name)) {
        optionMap.set(item.name, new Set());
      }
      optionMap.get(item.name).add(item.value);
    });

    const optionValues = normalizedAttrs.map((item) => item.value);
    const rawPrice =
      sku?.price?.sale_price_amount ||
      sku?.price?.amount ||
      sku?.sale_price ||
      sku?.price;
    const rawCompareAt =
      sku?.price?.list_price_amount ||
      sku?.price?.original_price_amount ||
      sku?.original_price ||
      sku?.compare_at_price;

    return {
      option1: optionValues[0] || null,
      option2: optionValues[1] || null,
      price: toNumber(rawPrice, 0),
      compare_at_price: toNumber(rawCompareAt, 0),
      sku: (sku?.seller_sku || sku?.sku_id || sku?.id || "").toString(),
      inventory_management: "shopify",
      inventory_policy: "deny",
      fulfillment_service: "manual",
      inventory_quantity: toNumber(
        sku?.inventory_quantity || sku?.quantity || sku?.stock_quantity,
        0
      ),
    };
  });

  const options = [...optionMap.entries()].map(([name, values]) => ({
    name,
    values: [...values],
  }));

  const rawTags = source?.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
    ? rawTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const imageCandidates = Array.isArray(source?.main_images)
    ? source.main_images
    : [];

  const images = collectImageUrls(imageCandidates);

  const videoUrl =
    source?.video?.url ||
    source?.product_video ||
    source?.video_url ||
    source?.video_info?.url;
  const videoThumbnailUrl =
    source?.video?.cover_url ||
    source?.video_thumbnail ||
    source?.video_cover_url ||
    source?.video_info?.cover_url;

  const metafields = [];
  if (videoUrl) {
    metafields.push({
      key: "product_video",
      value: videoUrl,
      type: "url",
      namespace: "custom",
    });
  }

  if (videoThumbnailUrl) {
    metafields.push({
      key: "product_video_thumbnail",
      value: videoThumbnailUrl,
      type: "url",
      namespace: "custom",
    });
  }

  const title =
    source?.title || source?.product_name || source?.name || "Untitled Product";

  return {
    product: {
      title,
      body_html: source?.description || source?.product_description || "",
      vendor: source?.brand_name || source?.brand || source?.seller_name || "",
      handle: source?.handle || slugify(title),
      status: (source?.status || source?.product_status || "active")
        .toString()
        .toLowerCase(),
      tags,
      product_type: source?.category_name || source?.product_type || "",
      published_scope: "global",
      options,
      variants,
      metafields,
    },
    images,
  };
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

// Product search endpoint
// GET /product-search
// Header: x-tts-access-token
// Query: appKey, appSecret, shopCipher, page_size?, page_token?, body?
// - body: optional JSON string (URL-encoded) that will be sent as POST body to TikTok
router.get("/product-search", async (req, res) => {
  try {
    const {
      appKey,
      appSecret,
      shopCipher,
      page_size = 20,
      page_token,
      body,
    } = req.query || {};
    const accessToken = req.headers["x-tts-access-token"];

    let bodyObj = {};
    if (body) {
      try {
        bodyObj = typeof body === "string" ? JSON.parse(body) : body;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: "Query param 'body' phải là JSON hợp lệ (string)",
        });
      }
    }

    if (!appKey || !appSecret || !accessToken || !shopCipher) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher",
      });
    }

    const result = await searchProducts({
      appKey,
      appSecret,
      accessToken,
      shopCipher,
      page_size,
      page_token,
      body: bodyObj,
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Search products thành công",
        ...result,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Product search route error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// Product detail endpoint
// GET /product-detail
// Header: x-tts-access-token
// Query: appKey, appSecret, shopCipher, product_id
router.get("/product-detail", async (req, res) => {
  try {
    const { appKey, appSecret, shopCipher, product_id } = req.query || {};
    const accessToken = req.headers["x-tts-access-token"];

    if (!appKey || !appSecret || !accessToken || !shopCipher || !product_id) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, product_id",
      });
    }

    const result = await getProduct({
      appKey,
      appSecret,
      accessToken,
      shopCipher,
      product_id,
    });

    if (result.success) {
      const mappedData = mapTikTokProductToJsonData(result.data);
      res.json({
        success: true,
        message: "Get product thành công",
        mapped_data: mappedData,
        ...result,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Product detail route error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// UI helper: Product search by shopName
// GET /tiktok-track/search-product?shopName=Baby%20Stafaz&page_size=20&page_token=&body={}
router.get("/tiktok-track/search-product", async (req, res) => {
  try {
    const {
      shopName = "Baby%20Stafaz",
      page_size = 20,
      page_token,
      body,
      appKey,
      appSecret,
      shopCipher,
      accessToken,
    } = req.query || {};

    let bodyObj = {};
    if (body) {
      try {
        bodyObj = typeof body === "string" ? JSON.parse(body) : body;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: "Query param 'body' phải là JSON hợp lệ (string)",
        });
      }
    }

    let shopData = null;
    if (!(appKey && appSecret && shopCipher && accessToken)) {
      shopData = await getShopData(shopName);
    }

    const finalAccessToken = accessToken || shopData?.accessToken;
    const finalAppKey = appKey || shopData?.appKey;
    const finalAppSecret = appSecret || shopData?.appSecret;
    const finalShopCipher = shopCipher || shopData?.shopCipher;

    if (!finalAppKey || !finalAppSecret || !finalShopCipher || !finalAccessToken) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc. Cần appKey, appSecret, shopCipher, accessToken (hoặc cung cấp shopName hợp lệ để hệ thống tự lấy)",
      });
    }

    const result = await searchProducts({
      appKey: finalAppKey,
      appSecret: finalAppSecret,
      accessToken: finalAccessToken,
      shopCipher: finalShopCipher,
      page_size,
      page_token,
      body: bodyObj,
    });

    if (result.success) {
      return res.json({
        success: true,
        message: "Search products thành công",
        ...result,
      });
    }

    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    console.error("Tiktok track search route error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
      details: error.message,
    });
  }
});

// UI helper: Product detail by shopName + product_id
// GET /tiktok-track/product-detail?shopName=Baby%20Stafaz&product_id=1730834815648588886
router.get("/tiktok-track/product-detail", async (req, res) => {
  try {
    const {
      shopName = "Baby%20Stafaz",
      product_id,
      appKey,
      appSecret,
      shopCipher,
      accessToken,
    } = req.query || {};

    if (!product_id) {
      return res.status(400).json({
        success: false,
        error: "Thiếu tham số bắt buộc: product_id",
      });
    }

    let shopData = null;
    if (!(appKey && appSecret && shopCipher && accessToken)) {
      shopData = await getShopData(shopName);
    }

    const finalAccessToken = accessToken || shopData?.accessToken;
    const finalAppKey = appKey || shopData?.appKey;
    const finalAppSecret = appSecret || shopData?.appSecret;
    const finalShopCipher = shopCipher || shopData?.shopCipher;

    if (!finalAppKey || !finalAppSecret || !finalShopCipher || !finalAccessToken) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc. Cần appKey, appSecret, shopCipher, accessToken (hoặc cung cấp shopName hợp lệ để hệ thống tự lấy)",
      });
    }

    const result = await getProduct({
      appKey: finalAppKey,
      appSecret: finalAppSecret,
      accessToken: finalAccessToken,
      shopCipher: finalShopCipher,
      product_id,
    });

    if (result.success) {
      const mappedData = mapTikTokProductToJsonData(result.data);
      return res.json({
        success: true,
        message: "Get product thành công",
        mapped_data: mappedData,
        ...result,
      });
    }

    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    console.error("Tiktok track product detail route error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
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
