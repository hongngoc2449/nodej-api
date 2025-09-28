const express = require("express");
const axios = require("axios");
const cors = require("cors");
const config = require("./config");
const {
  getOrderDetail,
  getOrderList,
  createPackage,
  getShipLabel,
} = require("./routes/r_tiktok_new");

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Node.js API Server",
    version: "1.0.0",
    endpoints: {
      "POST /generate-image": "Tạo hình ảnh từ text sử dụng Yescale API",
      "GET /order-detail": "Lấy thông tin đơn hàng TikTok",
      "POST /order-list": "Lấy danh sách đơn hàng TikTok",
      "POST /create-package":
        "Tạo package (shipping label) cho đơn hàng TikTok",
      "GET /ship-label": "Lấy URL shipping documents từ package ID",
    },
  });
});

// Generate image endpoint
app.post("/generate-image", async (req, res) => {
  try {
    const { text, numberOfImages = 1 } = req.body;
    if (!text)
      return res
        .status(400)
        .json({ success: false, error: "Text là bắt buộc" });

    const response = await axios.post(
      "https://api.yescale.io/v1/images/generations",
      {
        model: "imagen4",
        prompt: text,
        n: numberOfImages,
        size: "1024x1024",
        quality: "standard",
      },
      {
        headers: {
          Authorization: `Bearer ${config.IDEOGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      data: {
        prompt: text,
        numberOfImages,
        images: response.data.data.map((img, index) => ({
          id: index + 1,
          url: img.url,
          revised_prompt: img.revised_prompt,
        })),
        model: "imagen4",
      },
    });
  } catch (error) {
    console.error(
      "Error calling Yescale API:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: "Lỗi khi tạo hình ảnh",
      details: error.response?.data || error.message,
    });
  }
});

// Order detail endpoint
app.get("/order-detail", async (req, res) => {
  try {
    const { orderIds, appKey, appSecret, shopCipher } = req.query;
    const accessToken = req.headers["x-tts-access-token"];

    if (!orderIds || !appKey || !appSecret || !accessToken || !shopCipher) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc: orderIds, appKey, appSecret, shopCipher và x-tts-access-token header",
      });
    }

    const result = await getOrderDetail(
      orderIds,
      appKey,
      appSecret,
      shopCipher,
      accessToken
    );

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
app.post("/order-list", async (req, res) => {
  try {
    const {
      appKey,
      appSecret,
      shopCipher,
      startTime,
      endTime,
      orderStatus,
      deliveryOptionType,
      buyerUserId,
      pageSize = 20,
      cursor,
    } = req.body;
    const accessToken = req.headers["x-tts-access-token"];

    if (
      !appKey ||
      !appSecret ||
      !accessToken ||
      !shopCipher ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Thiếu tham số bắt buộc: appKey, appSecret, accessToken, shopCipher, startTime, endTime",
      });
    }

    const result = await getOrderList({
      appKey,
      appSecret,
      accessToken,
      shopCipher,
      startTime,
      endTime,
      orderStatus,
      deliveryOptionType,
      buyerUserId,
      pageSize,
      cursor,
    });

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

// Create package endpoint
app.post("/create-package", async (req, res) => {
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
app.get("/ship-label", async (req, res) => {
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

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: "Có lỗi xảy ra trên server" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint không tồn tại",
    requested: `${req.method} ${req.url}`,
    available: [
      "POST /generate-image",
      "GET /order-detail",
      "POST /order-list",
      "POST /create-package",
      "GET /ship-label",
    ],
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(
    `📝 API endpoints: POST /generate-image, GET /order-detail, POST /order-list, POST /create-package, GET /ship-label`
  );
});
