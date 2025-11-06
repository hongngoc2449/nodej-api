// userRoutes.js
const express = require("express");
const router = express.Router();
const { User } = require("../model/user");
const { shop } = require("../model/shop");
const { checkUserAccess, checkAuth } = require("../controller/checkUserAccess");

//#region LOGIN & REGISTER
router.get("/login", (req, res) => {
  if (req.session && req.session.loggedIn) {
    // Nếu đã đăng nhập, chuyển hướng về home
    console.log("da login--");
    return res.redirect("/");
  }

  // Nếu chưa đăng nhập, tiếp tục render trang login
  const redirectUrl = req.query.redirect || "";
  console.log(redirectUrl);
  res.render("login", { message: "", redirect: redirectUrl });
});

router.post("/login", async (req, res) => {
  const { username, password, redirect } = req.body;
  console.log(req.body);
  try {
    const user = await User.findOne({ username, password });

    if (user) {
      // Destructure and assign user properties to session, excluding password
      const { _id, username, kind, list_shop, platform } = user;
      req.session.user = {
        id: _id, // Đảm bảo lưu _id vào session
        username,
        kind,
        list_shop,
        platform,
      };
      req.session.loggedIn = true;
      console.log(req.session.user);

      let rd = redirect;
      if (user.kind === "designer online") {
        rd = "/ds-online";
      }
      return res.redirect(rd || "/");
    } else {
      // User not found
      res.render("login", { message: "Username hoặc password sai", redirect });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Lỗi máy chủ");
  }
});

router.get("/logout", (req, res) => {
  // Hủy session của người dùng
  req.session.destroy((err) => {
    if (err) {
      console.error("Error during session destroy:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }

    // Xóa cookie phiên mặc định của express-session
    res.clearCookie("connect.sid");

    //res.json({ success: true, message: "Logged out successfully" });
    res.redirect("/");
  });
});

// Render the register page
router.get("/register", (req, res) => {
  if (req.session && req.session.loggedIn) {
    // Nếu đã đăng nhập, chuyển hướng về home
    console.log("da login--");
    return res.redirect("/");
  }
  res.render("register", { message: null });
});

router.post("/register", async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  try {
    // Kiểm tra mật khẩu khớp
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu không khớp." });
    }

    // Kiểm tra người dùng đã tồn tại
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Tên người dùng đã được sử dụng." });
    }

    // Tạo người dùng mới
    const newUser = new User({ username, password });

    // Lưu vào cơ sở dữ liệu
    await newUser.save();

    // Trả về phản hồi thành công
    res.status(200).json({ message: "Đăng ký thành công." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đăng ký." });
  }
});
//#endregion

// #region User SETTING
router.get("/get-users", async (req, res) => {
  try {
    const kind = req.query.kind;

    const username = req.query.username;
    console.log(kind);

    let users;
    if (kind) {
      users = await User.find({ kind: kind }).select("-password");
    } else if (username) {
      users = await User.find({ username: username }).select("-password");
    } else {
      users = await User.find().select("-password"); // Get all users
    }
    res.json({ users: users }); // Pass them to the view
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/user", checkUserAccess(["admin", "leader"]), async (req, res) => {
  try {
    if (req.session && req.session.loggedIn) {
      console.log("da login");
      const username = req.session.user.username;
      const user = await User.findOne({ username: username });

      res.render("ds-user", {
        user: req.session.user,
        title: "Users",
        activePage: "user",
      });
    } else {
      console.log("chua login");
      res.redirect("/login?redirect=/setting");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.get(
  "/user-delete",
  checkUserAccess(["admin", "leader"]),
  async (req, res) => {
    try {
      const username = req.query.username;
      console.log(username);
      await User.deleteOne({ username: username });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  }
);

router.get(
  "/user-update",
  checkUserAccess(["admin", "leader"]),
  async (req, res) => {
    try {
      const kind = req.query.kind;
      const username = req.query.username;
      const user = await User.findOne({ username: username });
      user.kind = kind;
      await user.save();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  }
);
//#endregion

// #region PROFILE
router.get("/profile", checkAuth, (req, res) => {
  try {
    if (req.url.includes("&")) {
      getOrder(req, res);
    } else {
      res.render("n_profile", {
        user: req.session.user,
        title: "Profile",
        activePage: "profile",
      });
    }
  } catch (error) {
    next(error);
  }
});

// API lấy thông tin user từ session
router.get("/get-profile", checkAuth, async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.session.user.username,
    }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.kind === "admin") {
      const list_shop = await shop.find().select("shop_name");
      user.list_shop = list_shop.map((item) => item.shop_name);
    }
    res.json(user);
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Thêm routes mới
router.post("/change-password", checkAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Tìm user theo username từ session
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    // Kiểm tra mật khẩu hiện tại
    if (user.password !== currentPassword) {
      return res.json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    res.json({
      success: false,
      message: "Server error",
    });
  }
});
//#endregion

// Export module router
module.exports = router;
