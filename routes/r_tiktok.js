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

async function getOrderDetail(order_id, appKey, appSecret, accessToken) {
  const listOrder = {
    order_id_list: [order_id],
  };
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const path = "/api/orders/detail/query";
  const queries = {
    app_key: appKey,
    timestamp: timestamp,
  };

  const sign = generateSha256(path, queries, appSecret);
  const urlOrderDetail = `https://open-api.tiktokglobalshop.com${path}?app_key=${appKey}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}`;

  try {
    const response = await fetch(urlOrderDetail, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(listOrder),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // console.log(JSON.stringify(data, null, 4));
    return data;
  } catch (error) {
    console.error("Error fetching order details:", error);
    throw error;
  }
}

async function getCipher(accessToken, appKey, appSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const path = "/authorization/202309/shops";
  const headers = {
    "x-tts-access-token": accessToken,
  };
  const params = {
    app_key: appKey,
    timestamp: timestamp,
  };

  const sign = generateSha256(path, params, appSecret);
  const url = `https://open-api.tiktokglobalshop.com${path}?app_key=${appKey}&timestamp=${timestamp}&sign=${sign}`;

  const response = await fetch(url, {
    method: "GET",
    headers: headers,
  });

  const data = await response.json();
  console.log(data.data);
  const shopDoc = data.data.shops[0];

  const shop_id = shopDoc.id;
  const shop_code = shopDoc.code;
  const shop_name = shopDoc.name;
  const cipher = shopDoc.cipher;
  console.log(shop_id, shop_code, shop_name, cipher);
  return { shop_id, shop_code, shop_name, cipher };
}

async function getAccessToken(authorization_code, appKey, appSecret) {
  const urlAccessToken = `https://auth.tiktok-shops.com/api/v2/token/get?app_key=${appKey}&auth_code=${authorization_code}&app_secret=${appSecret}&grant_type=authorized_code`;
  console.log(urlAccessToken);

  try {
    const response = await fetch(urlAccessToken, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);

    const access_token = data.data.access_token;
    const refresh_token = data.data.refresh_token;

    console.log("access_token", access_token);
    console.log("refresh_token", refresh_token);

    return { access_token, refresh_token };
  } catch (error) {
    console.error("Error fetching access token:", error);
    throw error;
  }
}

async function teleMess(order_id, accessToken, appKey, appSecret) {
  const data = await getOrderDetail(order_id, appKey, appSecret, accessToken);
  const idata = data.data.order_list[0];
  // jsonOrder(idata); Luu du lieu Order vao database

  const taxes = idata.payment_info.taxes;
  const sub_total = idata.payment_info.sub_total;
  const original_total = idata.payment_info.original_total_product_price;
  const seller_discount = idata.payment_info.seller_discount;
  const total = (
    original_total -
    seller_discount -
    (original_total * 6.1) / 100
  ).toFixed(2);

  let message = "";
  let i = 0;
  for (const item of idata.item_list) {
    i++;
    message += `Item ${i}: ${item.sku_name} x ${item.quantity}\n`;
  }

  message += `Total: ${total} $`;
  // console.log(message);
  return message;
}

router.get("/resfresh-token", async (req, res) => {
  try {
    const shop_name = req.query.shop_name;
    let ishop;
    if (shop_name) {
      ishop = await shop.findOne({ shop_name: shop_name });
    } else {
      const accessToken = req.query.access_token;
      ishop = await shop.findOne({ access_token: accessToken });
    }

    if (!ishop) {
      return res
        .status(404)
        .json({ error: "Shop not found with this access token" });
    }

    console.log(`Refreshing token for shop: ${ishop.shop_name}`);

    const newToken = await refreshTokenForShop(ishop);

    if (newToken) {
      return res.json({
        success: true,
        message: "Token refreshed successfully",
        shop_name: ishop.shop_name,
        new_access_token: newToken,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Failed to refresh token",
      });
    }
  } catch (error) {
    console.error("Refresh token route error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

// ridect to tiktok shop
router.get("/add-tts-api", async (req, res) => {
  //https://hapitrack.com/add-tts-api?app_key=6clqafjs5rhoj&code=TTP_N_yS2gAAAACOS4mtd-PVebwj4dxbs4VTueZhPtBYbLaSUfaAHLiTd1-eRv_ugGvUrJy08DpZMDR7N5EY6Z472zM-qlP3aNo8q1lBieGNBtNFoP4pGsWT5zTk6UfJISfYg5_ddzT67Mc&locale=en&shop_region=US

  const appKey = "6eklpv48sqatl";
  const appSecret = "628681247a794cce5529bf3d690ee56c715b9b9c";
  const shareLink =
    "https://services.tiktokshops.us/open/authorize?service_id=7445208722014930734";
  try {
    console.log(req.query);
    const authorization_code = req.query.code;
    if (authorization_code !== authorization_code) {
      return res.status(401).send("Unauthorized");
    }
    console.log("authorization_code: ", authorization_code);
    const { access_token, refresh_token } = await getAccessToken(
      authorization_code,
      appKey,
      appSecret
    );

    console.log("access_token", access_token);
    console.log("refresh_token", refresh_token);
    const { shop_id, shop_code, shop_name, cipher } = await getCipher(
      access_token,
      appKey,
      appSecret
    );
    console.log("abc: ", shop_id, shop_code, shop_name, cipher);

    const ishop = await shop.findOneAndUpdate(
      { shop_name: shop_name }, // Điều kiện tìm kiếm
      {
        shop_id: shop_id,
        shop_code: shop_code,
        authorization_code: authorization_code,
        access_token: access_token,
        refresh_token: refresh_token,
        cipher: cipher,
        appKey: appKey,
        appSecret: appSecret,
        shareLink: shareLink,
        platform: "TIKTOK",
      },
      { new: true, upsert: true } // Tạo mới nếu không tồn tại, trả về tài liệu đã cập nhật hoặc tạo mới
    );

    console.log(ishop);
    res.json({ shop_id, shop_code, shop_name, status: "CONNECTED" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/add-tts-api-new", (req, res) => {
  const authorization_code = req.query.code; // Lấy từ link
  const success = req.query.success === "true"; // Kiểm tra xem có phải yêu cầu thành công
  res.render("add-tts-api-new", { authorization_code, success });
});

router.post("/add-tts-api-new", async (req, res) => {
  try {
    const { authorization_code, appKey, appSecret, shareLink } = req.body;
    console.log(
      "Input data: ",
      authorization_code,
      appKey,
      appSecret,
      shareLink
    );

    const { access_token, refresh_token } = await getAccessToken(
      authorization_code,
      appKey,
      appSecret
    );

    console.log("access_token", access_token);
    console.log("refresh_token", refresh_token);
    const { shop_id, shop_code, shop_name, cipher } = await getCipher(
      access_token,
      appKey,
      appSecret
    );

    const ishop = await shop.findOneAndUpdate(
      { shop_name: shop_name }, // Điều kiện tìm kiếm
      {
        shop_id: shop_id,
        shop_code: shop_code,
        authorization_code: authorization_code,
        access_token: access_token,
        refresh_token: refresh_token,
        cipher: cipher,
        appKey: appKey,
        appSecret: appSecret,
        shareLink: shareLink,
      },
      { new: true, upsert: true }
    );

    console.log(ishop);
    res.redirect("/add-tts-api-new?success=true"); // Redirect về giao diện với thông báo thành công
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// get all TIKTOK Shop
router.get("/get-tts", async (req, res) => {
  try {
    // const platform = req.query.platform; // Sử dụng query string thay vì params
    const shop_name = req.query.shop_name;
    if (!shop_name) {
      const shops = await shop.find({ platform: "TIKTOK" }); // Đúng tên trường là "platform"
      return res.json(shops);
    } else {
      const ishop = await shop.find({ shop_name: shop_name }); // Đúng tên trường là "platform"
      return res.json(ishop);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Export module router
router.get("/get-shop-no-appkey", async (req, res) => {
  try {
    const shops = await shop.find({
      $or: [
        { appKey: { $exists: false } }, // Trường appKey không tồn tại
        { appKey: "" }, // Trường appKey tồn tại nhưng rỗng
      ],
    });

    for (const ishop of shops) {
      ishop.appKey = appKey;
      ishop.appSecret = appSecret;
      ishop.shareLink = shareLink;

      await ishop.save();
    }
    res.json(shops);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Helper function để refresh token
async function refreshTokenForShop(shopDoc) {
  try {
    const refreshTokenValue = shopDoc.refresh_token;
    const appKey = shopDoc.appKey;
    const appSecret = shopDoc.appSecret;

    if (!refreshTokenValue) {
      throw new Error("No refresh token available");
    }

    const urlRefreshToken = `https://auth.tiktok-shops.com/api/v2/token/refresh?app_key=${appKey}&app_secret=${appSecret}&refresh_token=${refreshTokenValue}&grant_type=refresh_token`;

    const response = await fetch(urlRefreshToken, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Refresh token HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0 || !data.data) {
      throw new Error(`Refresh token API error: ${JSON.stringify(data)}`);
    }

    const newAccessToken = data.data.access_token;
    const newRefreshToken = data.data.refresh_token;

    if (!newAccessToken || !newRefreshToken) {
      throw new Error("Invalid tokens in refresh response");
    }

    // Update database
    shopDoc.access_token = newAccessToken;
    shopDoc.refresh_token = newRefreshToken;
    await shopDoc.save();

    console.log(
      `✅ Token refreshed successfully for shop: ${shopDoc.shop_name}`
    );
    return newAccessToken;
  } catch (error) {
    console.error(`❌ Token refresh failed:`, error);
    return null;
  }
}

// #endregion API TIKTOK SHOP

module.exports = {
  router,
  getOrderDetail,
  getCipher,
  teleMess,
};
