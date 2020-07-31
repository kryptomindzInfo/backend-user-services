const express = require("express");
const router = express.Router();

//services
const blockchain = require("../services/Blockchain.js");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const { calculateShare } = require("./utils/utility");

const cashierInvoicePay = require("./transactions/cashierInvoicePay");
const userInvoicePay = require("./transactions/userInvoicePay");

const Bank = require("../models/Bank");
const Branch = require("../models/Branch");
const Infra = require("../models/Infra");
const MerchantFee = require("../models/merchant/MerchantFee");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const Merchant = require("../models/merchant/Merchant");
const Cashier = require("../models/Cashier");
const User = require("../models/User");
const Invoice = require("../models/merchant/Invoice");
const Commission = require("../models/merchant/BankCommission");
const InvoiceGroup = require("../models/merchant/InvoiceGroup");

const jwtTokenAuth = require("./JWTTokenAuth");

router.post("/cashier/getInvoiceDetails", (req, res) => {
	const { token, number } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Cashier is not activated.",
				});
			} else {
				Invoice.findOne({ number: number }, async (err, invoice) => {
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else if (invoice == null) {
						res.status(200).json({
							status: 0,
							message: "Invoice not found",
						});
					} else {
						Merchant.findOne(
							{
								_id: invoice.merchant_id,
								bank_id: cashier.bank_id,
								status: 1,
							},
							(err, merchant) => {
								if (err) {
									console.log(err);
									var message = err;
									if (err.message) {
										message = err.message;
									}
									res.status(200).json({
										status: 0,
										message: message,
									});
								} else if (merchant == null) {
									res.status(200).json({
										status: 0,
										message: "Invalid Merchant",
									});
								} else {
									res.status(200).json({
										status: 1,
										invoice: invoice,
									});
								}
							}
						);
					}
				});
			}
		}
	);
});

router.post("/cashier/getUserInvoices", (req, res) => {
	try {
		const { token, mobile } = req.body;
		Cashier.findOne(
			{
				token,
				status: 1,
			},
			function (err, cashier) {
				if (err) {
					console.log(err);
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				} else if (cashier == null) {
					console.log(err);
					res.status(200).json({
						status: 0,
						message: "Cashier is not valid",
					});
				} else {
					Invoice.find({ mobile: mobile }, async (err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							var invoicePromises = invoices.map(async (invoice) => {
								var merchant = await Merchant.findOne({
									_id: invoice.merchant_id,
									bank_id: cashier.bank_id,
									status: 1,
								});
								if (merchant != null) {
									return invoice;
								}
							});
							var result = await Promise.all(invoicePromises);
							res.status(200).json({
								status: 1,
								invoices: result,
							});
						}
					});
				}
			}
		);
	} catch (err) {
		console.log(err);
		var message = err.toString();
		if (err.message) {
			message = err.message;
		}
		res.status(200).json({ status: 0, message: message, err: err });
	}
});

router.post("/cashier/payInvoice", (req, res) => {
	const { token, invoice_ids, merchant_id, amount } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantFee.findOne(
					{ merchant_id: merchant_id, type: 1 },
					(err, fee) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "Fee rule not found",
							});
						} else {
							Commission.findOne(
								{ merchant_id: merchant_id, type: 1 },
								async (err, comm) => {
									if (err) {
										console.log(err);
										var message = err;
										if (err.message) {
											message = err.message;
										}
										res.status(200).json({
											status: 0,
											message: message,
										});
									} else if (comm == null) {
										res.status(200).json({
											status: 0,
											message: "Commission rule not found",
										});
									} else {
										try {
											var invoice;
											var total_amount = 0;
											for (invoice_id of invoice_ids) {
												invoice = await Invoice.findOne({
													_id: invoice_id,
													merchant_id: merchant_id,
													paid: 0,
												});
												if (invoice == null) {
													throw new Error(
														"Invoice id " +
															invoice_id +
															" is already paid or it belongs to different merchant"
													);
												}
												total_amount += invoice.amount;
											}

											// all the users
											let branch = await Branch.findOne({
												_id: cashier.branch_id,
												status: 1,
											});
											if (branch == null) {
												throw new Error("Cashier has invalid branch");
											}

											let bank = await Bank.findOne({
												_id: branch.bank_id,
												status: 1,
											});
											if (bank == null) {
												throw new Error("Cashier's Branch has invalid bank");
											}

											// check branch operational wallet balance
											const branchOpWallet =
												branch.bcode + "_operational@" + bank.name;
											var bal = await blockchain.getBalance(branchOpWallet);
											console.log(branchOpWallet);
											if (Number(bal) < total_amount) {
												res.status(200).json({
													status: 0,
													message: "Not enough balance. Recharge Your wallet.",
												});
											} else {
												let infra = await Infra.findOne({
													_id: bank.user_id,
												});
												if (infra == null) {
													throw new Error("Cashier's bank has invalid infra");
												}

												let merchant = await Merchant.findOne({
													_id: merchant_id,
												});
												if (merchant == null) {
													throw new Error("Invoice has invalid merchant");
												}

												const today = new Date();
												await Merchant.findOneAndUpdate(
													{
														_id: merchant._id,
														last_paid_at: {
															$lte: new Date(today.setHours(00, 00, 00)),
														},
													},
													{ amount_collected: 0 }
												);

												var result = await cashierInvoicePay(
													total_amount,
													infra,
													bank,
													branch,
													merchant,
													fee,
													comm
												);
												var status_update_feedback;
												if (result.status == 1) {
													for (invoice_id of invoice_ids) {
														var i = await Invoice.findOneAndUpdate(
															{ _id: invoice_id },
															{ paid: 1 }
														);
														if (i == null) {
															status_update_feedback =
																"Invoice paid status can not be updated";
														}

														var last_paid_at = new Date();
														var m = await Merchant.updateOne(
															{ _id: merchant._id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	amount_collected: total_amount,
																	amount_due: -total_amount,
																	bills_paid: 1,
																},
															}
														);
														if (m == null) {
															status_update_feedback =
																"Merchant status can not be updated";
														}

														var mb = await MerchantBranch.updateOne(
															{ _id: branch._id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	amount_collected: total_amount,
																	amount_due: -total_amount,
																	bills_paid: 1,
																},
															}
														);
														if (mb == null) {
															status_update_feedback =
																"Merchant branch status can not be updated";
														}

														var ig = await InvoiceGroup.updateOne(
															{ _id: i.group_id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	bills_paid: 1,
																},
															}
														);
														if (ig == null) {
															status_update_feedback =
																"Invoice group status can not be updated";
														}

														var mc = await MerchantCashier.updateOne(
															{ _id: i.cashier_id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	bills_paid: 1,
																},
															}
														);
														if (mc == null) {
															status_update_feedback =
																"Merchant cashier status can not be updated";
														}

														bankFee = calculateShare("bank", total_amount, fee);
														var c = await Cashier.updateOne(
															{ _id: cashier._id },
															{
																$inc: {
																	cash_in_hand: total_amount + bankFee,
																},
															}
														);
														if (c == null) {
															status_update_feedback =
																"Bank cashier's cash in hand can not be updated";
														}

														content =
															"E-Wallet:  Amount " +
															i.amount +
															" is paid for invoice nummber " +
															i.number +
															" for purpose " +
															i.description;
														sendSMS(content, invoice.mobile);
													}
												}
												result.status_update_feedback = status_update_feedback;
												res.status(200).json(result);
											}
										} catch (err) {
											console.log(err);
											var message = err.toString();
											if (err.message) {
												message = err.message;
											}
											res
												.status(200)
												.json({ status: 0, message: message, err: err });
										}
									}
								}
							);
						}
					}
				);
			}
		}
	);
});

router.post("/user/getInvoices", jwtTokenAuth, (req, res) => {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (user == null) {
				res.status(200).json({
					status: 0,
					message: "User is not activated.",
				});
			} else {
				Bank.findOne({ name: user.bank }, (err, bank) => {
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else if (bank == null) {
						res.status(200).json({
							status: 0,
							message: "User's bank not found",
						});
					} else {
						try {
							Invoice.find({ mobile: user.mobile }, async (err, invoices) => {
								if (err) {
									console.log(err);
									var message = err;
									if (err.message) {
										message = err.message;
									}
									res.status(200).json({
										status: 0,
										message: message,
									});
								} else {
									var result = [];
									for (const invoice of invoices) {
										var merchant = await Merchant.findOne({
											_id: invoice.merchant_id,
											bank_id: bank._id,
											status: 1,
										});
										if (merchant) {
											result.push(invoice);
										}
									}
									res.status(200).json({
										status: 1,
										invoices: result,
									});
								}
							});
						} catch (err) {
							console.log("Catch block: ", err);
							var message = err.toString();
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({ status: 0, message: message, err: err });
						}
					}
				});
			}
		}
	);
});

router.post("/user/getInvoicesForMobile", jwtTokenAuth, (req, res) => {
	const { mobile } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, payer) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (payer == null) {
				res.status(200).json({
					status: 0,
					message: "User is not valid",
				});
			} else {
				User.findOne({ mobile: mobile, bank: payer.bank }, (err, payee) => {
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else if (payee == null) {
						res.status(200).json({
							status: 0,
							message: "Payee does not belong to " + payer.bank,
						});
					} else {
						Bank.findOne({ name: payee.bank }, (err, bank) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else if (bank == null) {
								res.status(200).json({
									status: 0,
									message: "User's bank not found",
								});
							} else {
								try {
									Invoice.find(
										{ mobile: payee.mobile },
										async (err, invoices) => {
											if (err) {
												console.log(err);
												var message = err;
												if (err.message) {
													message = err.message;
												}
												res.status(200).json({
													status: 0,
													message: message,
												});
											} else {
												var result = [];
												for (const invoice of invoices) {
													var merchant = await Merchant.findOne({
														_id: invoice.merchant_id,
														bank_id: bank._id,
														status: 1,
													});
													if (merchant) {
														result.push(invoice);
													}
												}
												res.status(200).json({
													status: 1,
													invoices: result,
												});
											}
										}
									);
								} catch (err) {
									console.log("Catch block: ", err);
									var message = err.toString();
									if (err.message) {
										message = err.message;
									}
									res
										.status(200)
										.json({ status: 0, message: message, err: err });
								}
							}
						});
					}
				});
			}
		}
	);
});

router.post("/user/payInvoice", jwtTokenAuth, (req, res) => {
	const { invoice_ids, merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (user == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "User is not valid",
				});
			} else {
				MerchantFee.findOne(
					{ merchant_id: merchant_id, type: 0 },
					(err, fee) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "Fee rule not found",
							});
						} else {
							Commission.findOne(
								{ merchant_id: merchant_id, type: 0 },
								async (err, comm) => {
									if (err) {
										console.log(err);
										var message = err;
										if (err.message) {
											message = err.message;
										}
										res.status(200).json({
											status: 0,
											message: message,
										});
									} else if (comm == null) {
										res.status(200).json({
											status: 0,
											message: "Commission rule not found",
										});
									} else {
										try {
											var invoice;
											var total_amount = 0;
											for (invoice_id of invoice_ids) {
												invoice = await Invoice.findOne({
													_id: invoice_id,
													merchant_id: merchant_id,
													paid: 0,
												});
												if (invoice == null) {
													throw new Error(
														"Invoice id " +
															invoice_id +
															" is already paid or it belongs to different merchant"
													);
												}
												total_amount += invoice.amount;
											}
											console.log(total_amount);
											// all the users
											let bank = await Bank.findOne({
												name: user.bank,
											});
											if (bank == null) {
												throw new Error("User has invalid bank");
											}

											// check branch operational wallet balance
											const userOpWallet = user.mobile + "@" + bank.name;
											var bal = await blockchain.getBalance(userOpWallet);
											console.log(bal);
											if (Number(bal) < total_amount) {
												res.status(200).json({
													status: 0,
													message: "Not enough balance. Recharge Your wallet.",
												});
											} else {
												let infra = await Infra.findOne({
													_id: bank.user_id,
												});
												if (infra == null) {
													throw new Error("User's bank has invalid infra");
												}

												let merchant = await Merchant.findOne({
													_id: merchant_id,
												});
												if (merchant == null) {
													throw new Error("Invoice has invalid merchant");
												}

												const today = new Date();
												await Merchant.findOneAndUpdate(
													{
														_id: merchant._id,
														last_paid_at: {
															$lte: new Date(today.setHours(00, 00, 00)),
														},
													},
													{ amount_collected: 0 }
												);
												var result = await userInvoicePay(
													total_amount,
													infra,
													bank,
													user,
													merchant,
													fee,
													comm
												);
												var status_update_feedback;
												if (result.status == 1) {
													for (invoice_id of invoice_ids) {
														var i = await Invoice.findOneAndUpdate(
															{ _id: invoice_id },
															{ paid: 1 }
														);
														if (i == null) {
															status_update_feedback =
																"Invoice status can not be updated";
														}

														var last_paid_at = new Date();
														var m = await Merchant.updateOne(
															{ _id: merchant._id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	amount_collected: total_amount,
																	amount_due: -total_amount,
																	bills_paid: 1,
																},
															}
														);
														if (m == null) {
															status_update_feedback =
																"Merchant status can not be updated";
														}

														var mc = await MerchantBranch.updateOne(
															{ _id: mcashier.branch_id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	amount_collected: total_amount,
																	amount_due: -total_amount,
																	bills_paid: 1,
																},
															}
														);
														if (mc == null) {
															status_update_feedback =
																"Merchant Branch status can not be updated";
														}

														var ig = await InvoiceGroup.updateOne(
															{ _id: i.group_id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	bills_paid: 1,
																},
															}
														);
														if (ig == null) {
															status_update_feedback =
																"Invoice group status can not be updated";
														}

														var mc = await MerchantCashier.updateOne(
															{ _id: mcashier._id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	bills_paid: 1,
																},
															}
														);
														if (mc == null) {
															status_update_feedback =
																"Merchant cashier status can not be updated";
														}

														content =
															"E-Wallet:: Due amount " +
															i.amount +
															" is paid for invoice nummber " +
															i.number +
															" for purpose " +
															i.description;
														sendSMS(content, invoice.mobile);
													}
												}
												result.status_update_feedback = status_update_feedback;
												res.status(200).json(result);
											}
										} catch (err) {
											console.log(err);
											var message = err;
											if (err && err.message) {
												message = err.message;
											}
											res.status(200).json({ status: 0, message: message });
										}
									}
								}
							);
						}
					}
				);
			}
		}
	);
});

module.exports = router;
