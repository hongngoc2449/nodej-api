const express = require("express");
const axios = require("axios");
const cors = require("cors");
const config = require("./config");
const r_tiktok_new = require("./routes/r_tiktok_new");

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use the router from r_tiktok_new
app.use(r_tiktok_new);

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

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: "Có lỗi xảy ra trên server" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(
    `📝 API endpoints: POST /generate-image, GET /order-detail, POST /order-list, POST /create-package`
  );
});
