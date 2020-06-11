// User.js
const mongoose = require("mongoose");
const MerchantCashierSchema = new mongoose.Schema({
	username: { type: String, required: false, default: null },
	name: { type: String, required: true, unique: true },
	mobile: { type: String, required: false },
	working_from: { type: String, required: false, default: 0 },
	working_to: { type: String, required: false, default: 0 },
	per_trans_amt: { type: String, required: false, default: 0 },
	max_trans_amt: { type: String, required: false, default: 0 },
	max_trans_count: { type: String, required: false, default: 0 },
	merchant_id: { type: String, required: true },
	branch_id: { type: String, required: true },
	staff_id: { type: String, required: false, default: null },
	status: { type: Number, required: true, default: 1 },
});
module.exports = mongoose.model("MerchantCashier", MerchantCashierSchema);
