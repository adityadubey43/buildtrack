const cloudinary = require("cloudinary").v2;

// Configure from either CLOUDINARY_URL or the three separate vars.
let configured = false;
if (process.env.CLOUDINARY_URL) {
  configured = true; // CLOUDINARY_URL auto-configures the SDK
} else if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

const isCloudinaryEnabled = () => configured;

// Upload an in-memory file buffer to Cloudinary, return the secure URL.
function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `buildtrack/${folder}`, resource_type: "auto" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, isCloudinaryEnabled, uploadBuffer };
