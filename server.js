require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const router = require("./routes/r_tiktok_new");
const larkRouter = require("./routes/r_lark");

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from patterns directory
app.use("/patterns", express.static(path.join(__dirname, "patterns")));
// Serve static assets from pattern/assets directory
app.use(
  "/pattern/assets",
  express.static(path.join(__dirname, "pattern", "assets"))
);

// View engine setup for EJS templates
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "pattern"));

// Use routers
app.use(router);
app.use(larkRouter);

// Routes
// Helper: list available text-based pattern files
function listTextPatternFiles() {
  const patternsDir = path.join(__dirname, "patterns");
  const allowed = new Set([".txt", ".ejs", ".tpl", ".md"]);
  try {
    const entries = fs.readdirSync(patternsDir, { withFileTypes: true });
    return entries
      .filter((ent) => ent.isFile())
      .map((ent) => ent.name)
      .filter((name) => allowed.has(path.extname(name).toLowerCase()));
  } catch (_) {
    return [];
  }
}

// Helper: list available image files from patterns/Set 1
function listImageFiles() {
  const set1Dir = path.join(__dirname, "patterns", "Set 1");
  const allowed = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg"]);
  try {
    const entries = fs.readdirSync(set1Dir, { withFileTypes: true });
    return entries
      .filter((ent) => ent.isFile())
      .map((ent) => {
        const name = ent.name;
        const ext = path.extname(name).toLowerCase();
        if (allowed.has(ext)) {
          // Extract character from filename (e.g., "A.png" -> "A")
          const char = path.basename(name, ext);
          return {
            filename: name,
            char: char,
            path: path.join(set1Dir, name),
          };
        }
        return null;
      })
      .filter((item) => item !== null)
      .sort((a, b) => {
        // Sort: numbers first (0-9), then letters (A-Z)
        const aIsNum = /^\d$/.test(a.char);
        const bIsNum = /^\d$/.test(b.char);
        if (aIsNum && !bIsNum) return -1;
        if (!aIsNum && bIsNum) return 1;
        return a.char.localeCompare(b.char);
      });
  } catch (_) {
    return [];
  }
}

// Pattern input UI
app.get("/pattern", (req, res) => {
  const patternFiles = listTextPatternFiles();
  const availableImages = listImageFiles();
  res.render("pattern", {
    data: {
      text: "",
      result: null,
      availableImages,
      error: null,
    },
  });
});

// Handle conversion from text to images
app.post("/pattern", (req, res) => {
  const { text, selectedChar } = req.body || {};
  const safeText = typeof text === "string" ? text.toUpperCase() : "";
  const availableImages = listImageFiles();

  let result = [];
  let error = null;

  if (!safeText) {
    error = "Vui lòng nhập text cần chuyển đổi";
  } else {
    // Convert each character to corresponding image
    for (let i = 0; i < safeText.length; i++) {
      const char = safeText[i];
      const imageInfo = availableImages.find((img) => img.char === char);

      if (imageInfo) {
        result.push({
          char: char,
          filename: imageInfo.filename,
          position: i,
        });
      } else {
        // If character not found, skip it or show placeholder
        result.push({
          char: char,
          filename: null,
          position: i,
          missing: true,
        });
      }
    }
  }

  res.render("pattern", {
    data: {
      text: safeText,
      result: result,
      availableImages,
      error: error,
    },
  });
});

app.get("/", (req, res) => {
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
