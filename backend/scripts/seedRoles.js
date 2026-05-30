// One-off script: create a login for every role under the admin@admin.com tenant.
// Usage: node scripts/seedRoles.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Tenant = require("../src/models/Tenant");

const ADMIN_EMAIL = "admin@admin.com";

const ROLE_USERS = [
  { role: "partner",    name: "Demo Partner",    email: "partner@admin.com" },
  { role: "engineer",   name: "Demo Engineer",   email: "engineer@admin.com" },
  { role: "supervisor", name: "Demo Supervisor", email: "supervisor@admin.com" },
  { role: "accountant", name: "Demo Accountant", email: "accountant@admin.com" },
];

function passwordFor(role) {
  return role.charAt(0).toUpperCase() + role.slice(1) + "@123";
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, family: 4 });
  console.log("Connected to MongoDB\n");

  const admin = await User.findOne({ email: ADMIN_EMAIL });
  if (!admin) {
    console.error(`Admin user ${ADMIN_EMAIL} not found. Sign up first.`);
    process.exit(1);
  }
  const tenantId = admin.tenantId;
  const tenant = await Tenant.findOne({ tenantId });
  console.log(`Tenant: ${tenant ? tenant.companyName : tenantId} (${tenantId})\n`);

  console.log("ROLE         EMAIL                     PASSWORD        STATUS");
  console.log("----         -----                     --------        ------");
  console.log(`admin        ${ADMIN_EMAIL.padEnd(25)} ${"Admin@123".padEnd(15)} existing`);

  for (const u of ROLE_USERS) {
    const password = passwordFor(u.role);
    let existing = await User.findOne({ tenantId, email: u.email });
    let status;
    if (existing) {
      existing.password = password; // re-set so the known password is guaranteed
      existing.role = u.role;
      existing.isActive = true;
      await existing.save();
      status = "updated";
    } else {
      await User.create({ tenantId, name: u.name, email: u.email, password, role: u.role });
      status = "created";
    }
    console.log(`${u.role.padEnd(12)} ${u.email.padEnd(25)} ${password.padEnd(15)} ${status}`);
  }

  console.log("\nDone.");
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
