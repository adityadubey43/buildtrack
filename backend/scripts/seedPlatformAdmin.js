// Create the first BuildTrack platform owner login.
// Usage: node scripts/seedPlatformAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const PlatformAdmin = require("../src/models/PlatformAdmin");

const OWNER = {
  name: "BuildTrack Owner",
  email: "owner@buildtrack.in",
  password: "Owner@123",
  role: "owner",
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, family: 4 });

  let admin = await PlatformAdmin.findOne({ email: OWNER.email });
  if (admin) {
    admin.password = OWNER.password; // reset to known password
    admin.isActive = true;
    await admin.save();
    console.log(`Updated existing platform admin: ${OWNER.email}`);
  } else {
    await PlatformAdmin.create(OWNER);
    console.log(`Created platform admin: ${OWNER.email}`);
  }

  console.log("\nLogin at /platform/login");
  console.log(`  Email:    ${OWNER.email}`);
  console.log(`  Password: ${OWNER.password}`);

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });
