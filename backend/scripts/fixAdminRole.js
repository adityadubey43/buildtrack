// Script to fix admin account role from office-staff back to admin
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/buildtrack";

async function fixAdminRole() {
  try {
    console.log("📦 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected!");

    // Find users with office-staff role that should be admin
    const officeStaffUsers = await User.find({ role: "office-staff" });
    
    if (officeStaffUsers.length === 0) {
      console.log("No office-staff users found.");
      return;
    }

    console.log(`\n Found ${officeStaffUsers.length} office-staff user(s):`);
    officeStaffUsers.forEach((u, i) => {
      console.log(`${i + 1}. ${u.name} (${u.email}) - Tenant: ${u.tenantId}`);
    });

    // If there's only one, fix it
    if (officeStaffUsers.length === 1) {
      const user = officeStaffUsers[0];
      console.log(`\n🔧 Fixing admin role for: ${user.name}`);
      user.role = "admin";
      await user.save();
      console.log(`✅ Role updated to "admin" for ${user.name} (${user.email})`);
    } else {
      // Multiple office-staff users - ask which one is admin
      console.log("\n⚠️ Multiple office-staff users found. Please specify which one is your admin account.");
      console.log("Run with email parameter: node fixAdminRole.js <email>");
      process.exit(1);
    }

    await mongoose.connection.close();
    console.log("\n✅ Done!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

// Allow fixing specific user by email
const targetEmail = process.argv[2];
if (targetEmail) {
  (async () => {
    try {
      console.log("📦 Connecting to MongoDB...");
      await mongoose.connect(MONGODB_URI);
      console.log("✅ Connected!");

      const user = await User.findOne({ email: targetEmail });
      if (!user) {
        console.log(`❌ User with email "${targetEmail}" not found.`);
        await mongoose.connection.close();
        process.exit(1);
      }

      console.log(`\nFound: ${user.name} (${user.email})`);
      console.log(`Current role: ${user.role}`);
      
      user.role = "admin";
      await user.save();
      console.log(`✅ Role updated to "admin"`);

      await mongoose.connection.close();
      console.log("✅ Done!");
    } catch (err) {
      console.error("❌ Error:", err.message);
      process.exit(1);
    }
  })();
} else {
  fixAdminRole();
}
