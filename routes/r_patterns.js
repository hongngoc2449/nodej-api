const express = require("express");
const router = express.Router();
const { PatternSet } = require("../model/pattern");
const { checkAuth } = require("../controller/checkUserAccess");

router.get("/api/pattern-sets", async (req, res) => {
  try {
    const filter =
      req.query.includeBuiltin === "1" ? {} : { source: "uploaded" };
    const sets = await PatternSet.find(filter).sort({ createdAt: 1 }).lean();
    const mapped = sets.map((s) => ({
      id: String(s._id),
      name: s.name,
      source: s.source,
      createdBy: s.createdBy ? String(s.createdBy) : null,
      createdByUsername: s.createdByUsername || "",
      images: (s.images || []).map((img) => ({
        char: img.char,
        url: img.url,
      })),
      previewImage: s.previewImage || null,
    }));
    res.json(mapped);
  } catch (e) {
    console.error("GET /api/pattern-sets error:", e);
    res.status(500).json([]);
  }
});

router.post("/api/pattern-sets", checkAuth, async (req, res) => {
  try {
    const { name, images, previewImage } = req.body || {};
    if (!name || !Array.isArray(images) || images.length === 0)
      return res.status(400).json({ error: "Invalid payload" });
    const createdBy = req.session?.user?.id || null;
    const createdByUsername = req.session?.user?.username || "";
    const doc = await PatternSet.create({
      name,
      source: "uploaded",
      images,
      previewImage: previewImage || null,
      createdBy,
      createdByUsername,
    });
    res.json({
      id: String(doc._id),
      name: doc.name,
      source: doc.source,
      createdBy: doc.createdBy ? String(doc.createdBy) : null,
      createdByUsername: doc.createdByUsername || "",
      images: (doc.images || []).map((img) => ({
        char: img.char,
        url: img.url,
      })),
      previewImage: doc.previewImage || null,
    });
  } catch (e) {
    console.error("POST /api/pattern-sets error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
