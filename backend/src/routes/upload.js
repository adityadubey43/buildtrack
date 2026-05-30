const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { isCloudinaryEnabled, uploadBuffer } = require("../config/cloudinary");

// Persist one uploaded file → Cloudinary in production, local disk in dev.
async function persist(file, folder, req) {
  if (isCloudinaryEnabled()) {
    const result = await uploadBuffer(file.buffer, folder);
    return result.secure_url;
  }
  // Local fallback (dev only) — write the buffer to /uploads and serve statically
  const dir = path.join(__dirname, "../../uploads", folder);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
  fs.writeFileSync(path.join(dir, name), file.buffer);
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/uploads/${folder}/${name}`;
}

function meta(file, url) {
  return { url, filename: path.basename(url), originalName: file.originalname, size: file.size, mimetype: file.mimetype };
}

// POST /api/upload?folder=dpr|attendance|expenses|general  (field: files)
router.post("/", protect, upload.array("files", 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded." });
    }
    const folder = req.query.folder || "general";
    const files = await Promise.all(req.files.map(async (f) => meta(f, await persist(f, folder, req))));
    res.json({ success: true, count: files.length, files });
  } catch (err) {
    next(err);
  }
});

// POST /api/upload/single  (field: file)
router.post("/single", protect, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });
    const folder = req.query.folder || "general";
    const url = await persist(req.file, folder, req);
    res.json({ success: true, file: meta(req.file, url) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
