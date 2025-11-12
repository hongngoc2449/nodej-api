// Cấu hình API
module.exports = {
  IDEOGRAM_API_KEY: "sk-HX2GR9hsMg7G9iArChoO9WGblNg2LYXwMgAT4ZZFlM0SDYd4",
  PORT: process.env.PORT || 3000,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:3000/auth/google/callback",
};
