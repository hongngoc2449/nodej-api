// userRoutes.js
const express = require("express");
const router = express.Router();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { User } = require("../model/user");
const { shop } = require("../model/shop");
const { Account } = require("../model/account");
const { checkUserAccess, checkAuth } = require("../controller/checkUserAccess");
const config = require("../config");

// Configure Passport Google Strategy
if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: config.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Kiểm tra email có trong profile
          if (
            !profile.emails ||
            !profile.emails[0] ||
            !profile.emails[0].value
          ) {
            return done(
              new Error("Không thể lấy email từ tài khoản Google"),
              null
            );
          }

          const email = profile.emails[0].value;

          // Tìm user theo googleId hoặc email
          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email: email }],
          });

          if (user) {
            // Cập nhật thông tin nếu chưa có googleId
            if (!user.googleId) {
              user.googleId = profile.id;
              user.email = email;
              user.authMethod = "google";
              await user.save();
            }
            return done(null, user);
          } else {
            // Tạo user mới
            const username = email.split("@")[0];
            // Đảm bảo username unique
            let uniqueUsername = username;
            let counter = 1;
            while (await User.findOne({ username: uniqueUsername })) {
              uniqueUsername = `${username}${counter}`;
              counter++;
            }

            user = new User({
              username: uniqueUsername,
              googleId: profile.id,
              email: email,
              authMethod: "google",
              kind: "user",
            });
            await user.save();
            return done(null, user);
          }
        } catch (error) {
          console.error("Google OAuth error:", error);
          return done(error, null);
        }
      }
    )
  );

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}

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
      // Redirect to dashboard if no specific redirect URL, or if redirect is "/"
      if (!rd || rd === "/") {
        rd = "/dashboard";
      }
      return res.redirect(rd);
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

// #region GOOGLE OAUTH
// Route để bắt đầu quá trình đăng nhập bằng Google
router.get(
  "/auth/google",
  (req, res, next) => {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
      return res
        .status(500)
        .send(
          "Google OAuth chưa được cấu hình. Vui lòng thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET vào file .env"
        );
    }
    // Lưu redirect URL vào session nếu có
    if (req.query.redirect) {
      req.session.redirectAfterAuth = req.query.redirect;
    }
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback route sau khi Google xác thực
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    try {
      // Lấy user từ passport
      const user = req.user;
      if (!user) {
        return res.redirect("/login?error=authentication_failed");
      }

      // Tạo session giống như đăng nhập thông thường
      const { _id, username, kind, list_shop, platform } = user;
      req.session.user = {
        id: _id,
        username,
        kind,
        list_shop,
        platform,
      };
      req.session.loggedIn = true;

      // Redirect về trang được yêu cầu hoặc trang mặc định
      const redirectUrl = req.session.redirectAfterAuth || "/";
      delete req.session.redirectAfterAuth;

      // Xử lý redirect đặc biệt cho designer online
      let finalRedirect = redirectUrl;
      if (user.kind === "designer online") {
        finalRedirect = "/ds-online";
      }

      res.redirect(finalRedirect);
    } catch (error) {
      console.error("Error in Google OAuth callback:", error);
      res.redirect("/login?error=server_error");
    }
  }
);
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

// #region DASHBOARD
router.get("/dashboard", checkAuth, (req, res) => {
  try {
    res.render("dashboard", {
      user: req.session.user,
      title: "Dashboard",
      activePage: "dashboard",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
//#endregion

// #region ACCOUNT
router.get("/account", checkAuth, (req, res) => {
  try {
    res.render("account", {
      user: req.session.user,
      title: "Account",
      activePage: "account",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
//#endregion

// #region SHOP
router.get("/shop", checkAuth, (req, res) => {
  try {
    res.render("shop", {
      user: req.session.user,
      title: "Shop",
      activePage: "shop",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
//#endregion

// #region ORDER
router.get("/order", checkAuth, (req, res) => {
  try {
    res.render("order", {
      user: req.session.user,
      title: "Order",
      activePage: "order",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
//#endregion

// #region ACCOUNT API
// API tạo mock account và shop
router.post("/api/accounts/create-mock", checkAuth, async (req, res) => {
  try {
    // Tạo dữ liệu mock
    const randomId = Math.floor(Math.random() * 10000);
    const timestamp = Date.now();
    
    const accountMockData = {
      loginName: `etsy_user_${randomId}`,
      primaryEmail: `etsy_user_${randomId}@example.com`,
      useNewEndpoints: Math.random() > 0.5,
      platform: "ETSY",
      accessToken: `mock_token_${timestamp}`,
      refreshToken: `mock_refresh_${timestamp}`,
      shopId: `shop_${randomId}`,
      shopName: `Etsy Shop ${randomId}`,
      status: "active",
      createdBy: req.session.user.id,
    };

    // Kiểm tra xem đã tồn tại chưa
    const existingAccount = await Account.findOne({
      loginName: accountMockData.loginName,
    });

    if (existingAccount) {
      return res.json({
        success: true,
        message: "Account already exists",
        account: existingAccount,
      });
    }

    // Tạo account mới
    const newAccount = new Account(accountMockData);
    await newAccount.save();

    // Tạo shop tương ứng với account
    const shopMockData = {
      platform: "ETSY",
      shop_id: `shop_${randomId}`,
      shop_code: `SHOP${randomId}`,
      shop_name: `Etsy Shop ${randomId}`,
      accountName: accountMockData.loginName,
      title: `Beautiful Handmade Items - Shop ${randomId}`,
      listingCount: Math.floor(Math.random() * 500) + 10, // 10-510 listings
      digitalCount: Math.floor(Math.random() * 100) + 5, // 5-105 digital items
      useNewEndpoints: accountMockData.useNewEndpoints,
      access_token: accountMockData.accessToken,
      refresh_token: accountMockData.refreshToken,
      status: "active",
      accountId: newAccount._id,
    };

    // Kiểm tra shop đã tồn tại chưa
    const existingShop = await shop.findOne({
      shop_id: shopMockData.shop_id,
    });

    let newShop;
    if (!existingShop) {
      newShop = new shop(shopMockData);
      await newShop.save();
    } else {
      newShop = existingShop;
    }

    res.json({
      success: true,
      message: "Mock account and shop created successfully",
      account: newAccount,
      shop: newShop,
    });
  } catch (error) {
    console.error("Error creating mock account:", error);
    res.status(500).json({
      success: false,
      message: "Error creating mock account",
      error: error.message,
    });
  }
});

// API lấy danh sách accounts
router.get("/api/accounts", checkAuth, async (req, res) => {
  try {
    const accounts = await Account.find()
      .sort({ createdAt: -1 })
      .populate("createdBy", "username")
      .lean();

    res.json({
      success: true,
      accounts: accounts,
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching accounts",
      error: error.message,
    });
  }
});

// API lấy danh sách shops
router.get("/api/shops", checkAuth, async (req, res) => {
  try {
    const shops = await shop
      .find()
      .sort({ createdAt: -1 })
      .populate("accountId", "loginName primaryEmail")
      .lean();

    res.json({
      success: true,
      shops: shops,
    });
  } catch (error) {
    console.error("Error fetching shops:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching shops",
      error: error.message,
    });
  }
});

// API xóa account
router.delete("/api/accounts/:id", checkAuth, async (req, res) => {
  try {
    const accountId = req.params.id;
    const deletedAccount = await Account.findByIdAndDelete(accountId);

    if (!deletedAccount) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    // Xóa shop liên quan nếu có
    await shop.deleteMany({ accountId: accountId });

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting account",
      error: error.message,
    });
  }
});

// API xóa shop
router.delete("/api/shops/:id", checkAuth, async (req, res) => {
  try {
    const shopId = req.params.id;
    const deletedShop = await shop.findByIdAndDelete(shopId);

    if (!deletedShop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    res.json({
      success: true,
      message: "Shop deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting shop:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting shop",
      error: error.message,
    });
  }
});

// API lấy thống kê cho dashboard
router.get("/api/dashboard/stats", checkAuth, async (req, res) => {
  try {
    const totalAccounts = await Account.countDocuments();
    const totalShops = await shop.countDocuments();
    const totalUsers = await User.countDocuments();

    // Tính tổng số orders (có thể lấy từ order model nếu có)
    // Tạm thời dùng số accounts làm proxy
    const totalOrders = totalAccounts * 10; // Mock data

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalShops,
        totalUsers,
        totalAccounts,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
});
//#endregion

// Export module router
module.exports = router;
