require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const config = require("./config");
const mongoose = require("mongoose");

const router = require("./routes/r_tiktok_new");
const r_lark = require("./routes/r_lark");
const r_user = require("./routes/r_user");
const r_patterns = require("./routes/r_patterns");

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View engine setup for EJS templates
app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.static("static"));

const { checkAuth } = require("./controller/checkUserAccess");

// MongoDB connection (optional)
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || undefined,
    })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => console.error("❌ MongoDB connection error:", err.message));
}

const session = require("express-session");
const passport = require("passport");

app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
    // Gia hạn thời hạn cookie trên mỗi request hoạt động
    rolling: true,
    // Thiết lập cookie an toàn hơn và bền hơn
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // yêu cầu HTTPS ở production
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Use routers (placed AFTER session so req.session is available)
app.use(router);
app.use(r_lark);
app.use(r_patterns);
app.use(r_user);

// Pattern UI
app.get("/pattern", checkAuth, async (req, res) => {
  res.render("pattern", {
    data: {
      text: "",
      result: null,
      availableImages: [],
      error: null,
    },
    user: req.session.user,
    title: "Pattern Image Converter",
    activePage: "pattern",
  });
});

// Home page route (public landing page)
app.get("/", (req, res) => {
  try {
    res.render("home", {
      title: "OwlFlow - Intelligent Order Management & Fulfillment Platform",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// App home route (for authenticated users - redirect to dashboard)
app.get("/app", checkAuth, (req, res) => {
  try {
    res.redirect("/dashboard");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// API info endpoint (for API documentation)
app.get("/api/info", (req, res) => {
  res.json({
    message: "Node.js API Server",
    version: "1.0.0",
    endpoints: {
      "POST /generate-image": "Tạo hình ảnh từ text sử dụng Yescale API",
      "GET /order-detail": "Lấy thông tin đơn hàng TikTok",
      "GET /order-list": "Lấy danh sách đơn hàng TikTok (hỗ trợ pagination)",
      "GET /finance-statements": "Lấy danh sách finance statements TikTok",
      "GET /order-tracking": "Lấy thông tin tracking đơn hàng TikTok",
      "POST /create-package":
        "Tạo package (shipping label) cho đơn hàng TikTok",
      "GET /ship-label": "Lấy URL shipping documents từ package ID",
      "POST /mark-package-as-shipped":
        "Đánh dấu package là đã gửi (seller fulfill)",
      "GET /lark/ping": "Kiểm tra tình trạng Lark route",
      "POST /lark/send": "Gửi tin nhắn văn bản qua Lark",
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
      "GET /finance-statements",
      "GET /order-tracking",
      "POST /create-package",
      "GET /ship-label",
      "POST /mark-package-as-shipped",
      "GET /lark/ping",
      "POST /lark/send",
    ],
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(
    `📝 API endpoints: POST /generate-image, GET /order-detail, POST /order-list, GET /finance-statements, GET /order-tracking, POST /create-package, GET /ship-label, POST /mark-package-as-shipped, GET /lark/ping, POST /lark/send`
  );
});
