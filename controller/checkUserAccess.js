// Check authentication - chỉ cần đăng nhập
const checkAuth = (req, res, next) => {
  if (req.session.loggedIn) {
    return next();
  }
  const returnUrl = encodeURIComponent(req.originalUrl);
  res.redirect(`/login?redirect=${returnUrl}`);
};

// Check user access - đăng nhập + phân quyền
function checkUserAccess(kinds) {
  return function (req, res, next) {
    if (req.session.user && kinds.includes(req.session.user.kind)) {
      next();
    } else {
      const returnUrl = encodeURIComponent(req.originalUrl);
      res.redirect(`/login?redirect=${returnUrl}`);
    }
  };
}

module.exports = { checkAuth, checkUserAccess };
