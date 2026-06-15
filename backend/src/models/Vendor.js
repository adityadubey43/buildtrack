const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name:     { type: String, required: true, trim: true },
    phone:    { type: String, trim: true },
    gstNumber:{ type: String, trim: true },
    address:  { type: String, trim: true },
    notes:    { type: String, trim: true },
  },
  { timestamps: true }
);

vendorSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model("Vendor", vendorSchema);
