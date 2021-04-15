//utils
const makeid = require("../../routes/utils/idGenerator");
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { jwtAuthentication } = require("./utils");

const addCashierSendRecord = require("../utils/addSendRecord");
const updateCashierRecords = require("../utils/updateSendRecord");

const Infra = require("../../models/Infra");
const Fee = require("../../models/Fee");
const User = require("../../models/User");
const Bank = require("../../models/Bank");
const Branch = require("../../models/Branch");
const Cashier = require("../../models/Cashier");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");

// transactions
const txstate = require("../transactions/services/states");
const cashierToOperational = require("../transactions/intraBank/cashierToOperational");
const cashierToCashier = require("../transactions/intraBank/cashierToCashier");
const cashierToWallet = require("../transactions/intraBank/cashierToWallet");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.cashierSendMoney = async function (req, res, next) {
	try {
		const {
			receiverMobile,
			receiverEmail,
			receiverIdentificationAmount,
			isInclusive,
		} = req.body;

		const transactionCode = makeid(8);

		jwtAuthentication("cashier", req, async function (err, cashier) {
			if (err) {
				res.status(200).json(err);
			} else {
				// Initiate transaction state
				const master_code = await txstate.initiate(
					categoryConst.MAIN,
					cashier.bank_id,
					"ABC",
					cashier._id,
					cashier.cash_in_hand,
					req.body,
				);

				Branch.findOne(
					{
						_id: cashier.branch_id,
					},
					function (err, branch) {
						let errMsg = errorMessage(err, branch, "Branch Not Found");
						if (errMsg.status == 0) {
							res.status(200).json(errMsg);
						} else {
							Bank.findOne(
								{
									_id: cashier.bank_id,
								},
								function (err, bank) {
									let errMsg = errorMessage(err, bank, "Bank Not Found");
									if (errMsg.status == 0) {
										res.status(200).json(errMsg);
									} else {
										Infra.findOne(
											{
												_id: bank.user_id,
											},
											function (err, infra) {
												let result = errorMessage(
													err,
													infra,
													"Infra Not Found"
												);
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													const find = {
														bank_id: bank._id,
														trans_type: "Non Wallet to Non Wallet",
														status: 1,
														active: "Active",
													};
													Fee.findOne(find, function (err, rule) {
														let errMsg = errorMessage(
															err,
															rule,
															"Revenue Rule Not Found"
														);
														if (errMsg.status == 0) {
															res.status(200).json(errMsg);
														} else {
															var otherInfo = {
																cashierId: cashier._id,
																transactionCode: transactionCode,
																ruleType: "Non Wallet to Non Wallet",
																masterCode: master_code,
																branchId: branch._id,
																branchType: "branch",
															};
															addCashierSendRecord(
																req.body,
																otherInfo,
																(err, cs) => {
																	if (err) {
																		res.status(200).json(catchError(err));
																	} else {
																		const transfer = {
																			amount: receiverIdentificationAmount,
																			isInclusive: isInclusive,
																			master_code: master_code,
																			senderType: "sendBranch",
																			senderCode: branch.bcode,
																			cashierId: cashier._id,
																		};
																		cashierToCashier(
																			transfer,
																			infra,
																			bank,
																			branch,
																			rule
																		)
																			.then(function (result) {
																				console.log("Result: " + result);
																				if (result.status == 1) {
																					let content =
																						"Your Transaction Code is " +
																						transactionCode;
																					if (
																						receiverMobile &&
																						receiverMobile != null
																					) {
																						sendSMS(content, receiverMobile);
																					}
																					if (
																						receiverEmail &&
																						receiverEmail != null
																					) {
																						sendMail(
																							content,
																							"Transaction Code",
																							receiverEmail
																						);
																					}

																					otherInfo.csId = cs._id;
																					otherInfo.amount = result.amount;
																					otherInfo.fee = result.fee;
																					otherInfo.sendFee = result.sendFee;

																					updateCashierRecords(
																						"cashier",
																						otherInfo,
																						(err) => {
																							if (err) {
																								res
																									.status(200)
																									.json(catchError(err));
																							} else {
																								txstate.waitingForCompletion(
																									categoryConst.MAIN,
																									master_code
																								);
																								res.status(200).json({
																									status: 1,
																									message:
																										"transaction success",
																								});
																							}
																						}
																					);
																				} else {
																					txstate.failed(
																						categoryConst.MAIN,
																						master_code
																					);
																					res.status(200).json(result);
																				}
																			})
																			.catch((err) => {
																				txstate.failed(
																					categoryConst.MAIN,
																					master_code
																				);
																				res.status(200).json(catchError(err));
																			});
																	}
																}
															);
														}
													});
												} //infra
											}
										);
									}
								}
							);
						}
					}
				); //branch
			}
		});
	} catch (err) {
		res.status(200).json(catchError(err));
	}
};

module.exports.partnerSendMoney = async function (req, res) {
	try {
		const {
			receiverMobile,
			receiverEmail,
			receiverIdentificationAmount,
			isInclusive,
		} = req.body;

		const transactionCode = makeid(8);

		jwtAuthentication("partnerCashier", req, async function (err, cashier) {
			if (err) {
				res.status(200).json(err);
			} else {
				// Initiate transaction state
				const master_code = await txstate.initiate(
					categoryConst.MAIN,
					cashier.bank_id,
					"Non Wallet To Non Wallet",
					cashier._id,
					""
				);
				Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
					let result = errorMessage(err, partner, "Partner not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						PartnerBranch.findOne(
							{
								_id: cashier.branch_id,
							},
							function (err, branch) {
								let result = errorMessage(err, branch, "Branch Not Found");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									Bank.findOne(
										{
											_id: partner.bank_id,
										},
										function (err, bank) {
											let result = errorMessage(err, bank, "Bank Not Found");
											if (result.status == 0) {
												res.status(200).json(result);
											} else {
												Infra.findOne(
													{
														_id: bank.user_id,
													},
													function (err, infra) {
														let result = errorMessage(
															err,
															infra,
															"Infra Not Found"
														);
														if (result.status == 0) {
															res.status(200).json(result);
														} else {
															const find = {
																bank_id: bank._id,
																trans_type: "Non Wallet to Non Wallet",
																status: 1,
																active: "Active",
															};
															Fee.findOne(find, function (err, rule) {
																let result = errorMessage(
																	err,
																	rule,
																	"Revenue Rule Not Found"
																);
																if (result.status == 0) {
																	res.status(200).json(result);
																} else {
																	var otherInfo = {
																		cashierId: cashier._id,
																		transactionCode: transactionCode,
																		ruleType: "Non Wallet to Non Wallet",
																		masterCode: master_code,
																		branchId: branch._id,
																		branchType: "partnerbranch",
																	};
																	addCashierSendRecord(
																		req.body,
																		otherInfo,
																		(err, cs) => {
																			if (err) {
																				res.status(200).json(catchError(err));
																			} else {
																				const transfer = {
																					amount: receiverIdentificationAmount,
																					isInclusive: isInclusive,
																					senderType: "sendPartner",
																					senderCode: partner.code,
																					master_code: master_code,
																					cashierId: cashier._id,
																				};
																				cashierToCashier(
																					transfer,
																					infra,
																					bank,
																					branch,
																					rule
																				)
																					.then(function (result) {
																						console.log("Result: " + result);
																						if (result.status == 1) {
																							let content =
																								"Your Transaction Code is " +
																								transactionCode;

																							if (
																								receiverMobile &&
																								receiverMobile != null
																							) {
																								sendSMS(
																									content,
																									receiverMobile
																								);
																							}

																							if (
																								receiverEmail &&
																								receiverEmail != null
																							) {
																								sendMail(
																									content,
																									"Transaction Code",
																									receiverEmail
																								);
																							}

																							otherInfo.csId = cs._id;
																							otherInfo.amount = result.amount;
																							otherInfo.fee = result.fee;
																							otherInfo.sendFee =
																								result.sendFee;

																							updateCashierRecords(
																								"partnercashier",
																								otherInfo,
																								(err) => {
																									if (err) {
																										res
																											.status(200)
																											.json(catchError(err));
																									} else {
																										txstate.waitingForCompletion(
																											categoryConst.MAIN,
																											master_code
																										);
																										res.status(200).json({
																											status: 1,
																											message:
																												"transaction success",
																										});
																									}
																								}
																							);
																						} else {
																							txstate.failed(
																								categoryConst.MAIN,
																								master_code
																							);
																							res.status(200).json(result);
																						}
																					})
																					.catch((err) => {
																						txstate.failed(
																							categoryConst.MAIN,
																							master_code
																						);
																						res.status.json(catchError(err));
																					});
																			}
																		}
																	);
																}
															});
														} //infra
													}
												);
											}
										}
									);
								}
							}
						); //branch
					}
				});
			}
		});
	} catch (err) {
		res.status(200).json(catchError(err));
	}
};

module.exports.cashierSendMoneyToWallet = async function (req, res) {
	try {
		const {
			receiverMobile,
			receiverIdentificationAmount,
			isInclusive,
		} = req.body;

		jwtAuthentication("cashier", req, async function (err, cashier) {
			if (err) {
				res.status(200).json(err);
			} else {
				// Initiate transaction state
				const master_code = await txstate.initiate(
					categoryConst.MAIN,
					cashier.bank_id,
					"Non Wallet to Wallet",
					cashier._id,
					cashier.cash_in_hand,
					req.body,
				);
				User.findOne(
					{
						mobile: receiverMobile,
					},
					function (err, receiver) {
						let result = errorMessage(err, receiver, "Receiver Not Found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Branch.findOne(
								{
									_id: cashier.branch_id,
								},
								function (err, branch) {
									let result = errorMessage(err, branch, "Branch Not Found");
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										Bank.findOne(
											{
												_id: cashier.bank_id,
											},
											function (err, bank) {
												let result = errorMessage(err, bank, "Bank Not Found");
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													Infra.findOne(
														{
															_id: bank.user_id,
														},
														function (err, infra) {
															let result = errorMessage(
																err,
																infra,
																"Infra Not Found"
															);
															if (result.status == 0) {
																res.status(200).json(result);
															} else {
																const find = {
																	bank_id: bank._id,
																	trans_type: "Non Wallet to Wallet",
																	status: 1,
																	active: "Active",
																};
																Fee.findOne(find, function (err, rule) {
																	let result = errorMessage(
																		err,
																		rule,
																		"Revenue Rule Not Found"
																	);
																	if (result.status == 0) {
																		res.status(200).json(result);
																	} else {
																		req.body.withoutID = false;
																		req.body.receiverccode = "";
																		req.body.receiverGivenName = receiver.name;
																		req.body.receiverFamilyName =
																			receiver.last_name;
																		req.body.receiverCountry = receiver.country;
																		req.body.receiverEmail = receiver.email;
																		req.body.receiverIdentificationCountry = "";
																		req.body.receiverIdentificationType =
																			receiver.id_type;
																		req.body.receiverIdentificationNumber =
																			receiver.id_number;
																		req.body.receiverIdentificationValidTill =
																			receiver.valid_till;

																		var otherInfo = {
																			cashierId: cashier._id,
																			transactionCode: "",
																			ruleType: "Non Wallet to Wallet",
																			masterCode: master_code,
																		};
																		addCashierSendRecord(
																			req.body,
																			otherInfo,
																			(err, cs) => {
																				if (err) {
																					res.status(200).json(catchError(err));
																				} else {
																					const transfer = {
																						amount: receiverIdentificationAmount,
																						isInclusive: isInclusive,
																						master_code: master_code,
																						senderType: "sendBranch",
																						senderCode: branch.bcode,
																						cashierId: cashier._id,
																					};
																					cashierToWallet(
																						transfer,
																						infra,
																						bank,
																						branch,
																						receiver,
																						rule
																					)
																						.then(function (result) {
																							console.log("Result: " + result);
																							if (result.status == 1) {
																								otherInfo.csId = cs._id;
																								otherInfo.amount =
																									result.amount;
																								otherInfo.fee = result.fee;
																								otherInfo.sendFee =
																									result.sendFee;

																								updateCashierRecords(
																									"cashier",
																									otherInfo,
																									(err) => {
																										if (err) {
																											res
																												.status(200)
																												.json(catchError(err));
																										} else {
																											txstate.completed(
																												categoryConst.MAIN,
																												master_code
																											);
																											res.status(200).json({
																												status: 1,
																												message:
																													"transaction success",
																											});
																										}
																									}
																								);
																							} else {
																								txstate.failed(
																									categoryConst.MAIN,
																									master_code
																								);
																								res.status(200).json(result);
																							}
																						})
																						.catch((err) => {
																							console.log(err);
																							txstate.failed(
																								categoryConst.MAIN,
																								master_code
																							);
																							res.status(200).json({
																								status: 0,
																								message: err.message,
																							});
																						});
																				}
																			}
																		);
																	}
																});
															} //infra
														}
													);
												}
											}
										);
									}
								}
							); //branch
						}
					}
				);
			}
		});
	} catch (err) {
		res.status(200).json(catchError(err));
	}
};

module.exports.partnerSendMoneyToWallet = async function (req, res) {
	const {
		receiverMobile,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	jwtAuthentication("partnerCashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction state
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Non Wallet to Wallet",
				cashier._id,
				""
			);
			Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
				let result = errorMessage(err, partner, "Partner Not Found");
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					User.findOne(
						{
							mobile: receiverMobile,
						},
						function (err, receiver) {
							let result = errorMessage(err, receiver, "Receiver Not Found");
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								PartnerBranch.findOne(
									{
										_id: cashier.branch_id,
									},
									function (err, branch) {
										let result = errorMessage(err, branch, "Branch Not Found");
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											Bank.findOne(
												{
													_id: cashier.bank_id,
												},
												function (err, bank) {
													let result = errorMessage(
														err,
														bank,
														"Bank Not Found"
													);
													if (result.status == 0) {
														res.status(200).json(result);
													} else {
														Infra.findOne(
															{
																_id: bank.user_id,
															},
															function (err, infra) {
																let result = errorMessage(
																	err,
																	infra,
																	"Infra Not Found"
																);
																if (result.status == 0) {
																	res.status(200).json(result);
																} else {
																	const find = {
																		bank_id: bank._id,
																		trans_type: "Non Wallet to Wallet",
																		status: 1,
																		active: "Active",
																	};

																	Fee.findOne(find, function (err, rule) {
																		let result = errorMessage(
																			err,
																			rule,
																			"Revenue Rule Not Found"
																		);
																		if (result.status == 0) {
																			res.status(200).json(result);
																		} else {
																			req.body.withoutID = false;
																			req.body.receiverccode = "";
																			req.body.receiverGivenName =
																				receiver.name;
																			req.body.receiverFamilyName =
																				receiver.last_name;
																			req.body.receiverCountry =
																				receiver.country;
																			req.body.receiverEmail = receiver.email;
																			req.body.receiverIdentificationCountry =
																				"";
																			req.body.receiverIdentificationType =
																				receiver.id_type;
																			req.body.receiverIdentificationNumber =
																				receiver.id_number;
																			req.body.receiverIdentificationValidTill =
																				receiver.valid_till;

																			var otherInfo = {
																				cashierId: cashier._id,
																				transactionCode: "",
																				ruleType: "Non Wallet to Wallet",
																				masterCode: master_code,
																			};
																			addCashierSendRecord(
																				req.body,
																				otherInfo,
																				(err, cs) => {
																					if (err) {
																						res
																							.status(200)
																							.json(catchError(err));
																					} else {
																						const transfer = {
																							amount: receiverIdentificationAmount,
																							isInclusive: isInclusive,
																							master_code: master_code,
																							senderType: "sendPartner",
																							senderCode: partner.code,
																							cashierId: cashier._id,
																						};
																						cashierToWallet(
																							transfer,
																							infra,
																							bank,
																							branch,
																							receiver,
																							rule
																						)
																							.then(function (result) {
																								console.log(
																									"Result: " + result
																								);
																								if (result.status == 1) {
																									otherInfo.csId = cs._id;
																									otherInfo.amount =
																										result.amount;
																									otherInfo.fee = result.fee;
																									otherInfo.sendFee =
																										result.sendFee;

																									updateCashierRecords(
																										"partnerCashier",
																										otherInfo,
																										(err) => {
																											if (err) {
																												res
																													.status(200)
																													.json(
																														catchError(err)
																													);
																											} else {
																												txstate.completed(
																													categoryConst.MAIN,
																													master_code
																												);
																												res.status(200).json({
																													status: 1,
																													message:
																														"transaction success",
																												});
																											}
																										}
																									);
																								} else {
																									txstate.failed(
																										categoryConst.MAIN,
																										master_code
																									);
																									res.status(200).json(result);
																								}
																							})
																							.catch((err) => {
																								txstate.failed(
																									categoryConst.MAIN,
																									master_code
																								);
																								console.log(err.toString());
																								res.status(200).json({
																									status: 0,
																									message: err.message,
																								});
																							});
																					}
																				}
																			);
																		}
																	});
																} //infra
															}
														);
													}
												}
											);
										}
									}
								); //branch
							}
						}
					);
				}
			});
		}
	});
};

module.exports.cashierSendToOperational = async function (req, res) {
	const { walletId, receiverIdentificationAmount, isInclusive } = req.body;
	jwtAuthentication("cashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction state
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Non Wallet to Operational",
				cashier._id,
				""
			);
			Branch.findOne({ _id: cashier.branch_id }, (err, branch) => {
				let result = errorMessage(err, branch, "Branch not found");
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					PartnerBranch.findOne(
						{
							bank_id: branch.bank_id,
							"wallet_ids.operational": walletId,
						},
						(err, toBranch) => {
							let errMsg = errorMessage(err, toBranch, "Invalid wallet ID");
							if (errMsg.status == 0) {
								res.status(200).json(errMsg);
							} else {
								const find = {
									bank_id: branch.bank_id,
									trans_type: "Non Wallet to Operational",
									status: 1,
									active: "Active",
								};
								Fee.findOne(find, (err, rule) => {
									let errMsg = errorMessage(err, rule, "Rule not found");
									if (errMsg.status == 0) {
										res.status(200).json(errMsg);
									} else {
										Bank.findOne({ _id: branch.bank_id }, (err, bank) => {
											let errMsg = errorMessage(err, bank, "Bank not found");
											if (errMsg.status == 0) {
												res.status(200).json(errMsg);
											} else {
												Infra.findOne({ _id: bank.user_id }, (err, infra) => {
													let errMsg = errorMessage(
														err,
														infra,
														"Infra not found"
													);
													if (errMsg.status == 0) {
														res.status(200).json(errMsg);
													} else {
														req.body.withoutID = false;
														req.body.receiverccode = toBranch.ccode;
														req.body.receiverGivenName = toBranch.name;
														req.body.receiverFamilyName = "";
														req.body.receiverCountry = toBranch.country;
														req.body.receiverMobile = toBranch.mobile;
														req.body.receiverEmail = toBranch.email;
														req.body.receiverIdentificationCountry = "";
														req.body.receiverIdentificationType = "";
														req.body.receiverIdentificationNumber = "";
														req.body.receiverIdentificationValidTill = "";

														var otherInfo = {
															cashierId: cashier._id,
															transactionCode: "",
															ruleType: "Non Wallet to Operational",
															masterCode: master_code,
														};
														addCashierSendRecord(
															req.body,
															otherInfo,
															(err, cs) => {
																if (err) {
																	res.status(200).json(catchError(err));
																} else {
																	const transfer = {
																		amount: receiverIdentificationAmount,
																		isInclusive: isInclusive,
																		master_code: master_code,
																		senderType: "sendBranch",
																		senderCode: branch.bcode,
																		cashierId: cashier._id,
																	};
																	cashierToOperational(
																		transfer,
																		infra,
																		bank,
																		branch,
																		toBranch,
																		rule
																	)
																		.then((result) => {
																			if (result.status == 1) {
																				otherInfo.csId = cs._id;
																				otherInfo.amount = result.amount;
																				otherInfo.fee = result.fee;
																				otherInfo.sendFee = result.sendFee;

																				updateCashierRecords(
																					"cashier",
																					otherInfo,
																					(err) => {
																						if (err) {
																							res
																								.status(200)
																								.json(catchError(err));
																						} else {
																							txstate.completed(
																								categoryConst.MAIN,
																								master_code
																							);
																							res.status(200).json({
																								status: 1,
																								message:
																									result.amount +
																									"XOF amount is Transferred",
																							});
																						}
																					}
																				);
																			} else {
																				txstate.failed(
																					categoryConst.MAIN,
																					master_code
																				);
																				res.status(200).json(result);
																			}
																		})
																		.catch((err) => {
																			txstate.failed(
																				categoryConst.MAIN,
																				master_code
																			);
																			console.log(err);
																			res.status(200).json({
																				status: 0,
																				message: err.message,
																			});
																		});
																}
															}
														);
													}
												});
											}
										});
									}
								});
							}
						}
					);
				}
			});
		}
	});
};

module.exports.partnerSendToOperational = async function (req, res) {
	const { wallet_id, receiverIdentificationAmount, isInclusive } = req.body;
	jwtAuthentication("partnerCashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction state
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Non Wallet to Operational",
				cashier._id,
				""
			);
			Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
				let result = errorMessage(err, partner, "Partner Not Found");
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					PartnerBranch.findOne({ _id: cashier.branch_id }, (err, branch) => {
						let result = errorMessage(err, branch, "Branch not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							PartnerBranch.findOne(
								{
									_id: { $ne: branch._id },
									bank_id: cashier.bank_id,
									"wallet_ids.operational": wallet_id,
								},
								(err, toBranch) => {
									let result = errorMessage(err, toBranch, "Invalid wallet ID");
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										const find = {
											bank_id: cashier.bank_id,
											trans_type: "Non Wallet to Operational",
											status: 1,
											active: "Active",
										};
										Fee.findOne(find, (err, rule) => {
											let result = errorMessage(err, rule, "Rule not found");
											if (result.status == 0) {
												res.status(200).json(result);
											} else {
												Bank.findOne({ _id: cashier.bank_id }, (err, bank) => {
													let result = errorMessage(
														err,
														bank,
														"Bank not found"
													);
													if (result.status == 0) {
														res.status(200).json(result);
													} else {
														Infra.findOne(
															{ _id: bank.user_id },
															(err, infra) => {
																let result = errorMessage(
																	err,
																	infra,
																	"Infra not found"
																);
																if (result.status == 0) {
																	res.status(200).json(result);
																} else {
																	req.body.withoutID = false;
																	req.body.receiverccode = toBranch.ccode;
																	req.body.receiverGivenName = toBranch.name;
																	req.body.receiverFamilyName = "";
																	req.body.receiverCountry = toBranch.country;
																	req.body.receiverMobile = toBranch.mobile;
																	req.body.receiverEmail = toBranch.email;
																	req.body.receiverIdentificationCountry = "";
																	req.body.receiverIdentificationType = "";
																	req.body.receiverIdentificationNumber = "";
																	req.body.receiverIdentificationValidTill = "";

																	var otherInfo = {
																		cashierId: cashier._id,
																		transactionCode: "",
																		ruleType: "Non Wallet to Operational",
																		masterCode: master_code,
																	};
																	addCashierSendRecord(
																		req.body,
																		otherInfo,
																		(err, cs) => {
																			if (err) {
																				res.status(200).json(catchError(err));
																			} else {
																				const transfer = {
																					amount: receiverIdentificationAmount,
																					isInclusive: isInclusive,
																					master_code: master_code,
																					senderType: "sendPartner",
																					senderCode: partner.code,
																					cashierId: cashier._id,
																				};
																				cashierToOperational(
																					transfer,
																					infra,
																					bank,
																					branch,
																					toBranch,
																					rule
																				)
																					.then((result) => {
																						if (result.status == 1) {
																							otherInfo.csId = cs._id;
																							otherInfo.amount = result.amount;
																							otherInfo.fee = result.fee;
																							otherInfo.sendFee =
																								result.sendFee;

																							updateCashierRecords(
																								"partnercashier",
																								otherInfo,
																								(err) => {
																									if (err) {
																										res
																											.status(200)
																											.json(catchError(err));
																									} else {
																										txstate.completed(
																											categoryConst.MAIN,
																											master_code
																										);
																										res.status(200).json({
																											status: 1,
																											message:
																												result.amount +
																												"XOF amount is Transferred",
																										});
																									}
																								}
																							);
																						} else {
																							res.status(200).json(result);
																						}
																					})
																					.catch((err) => {
																						console.log(err);
																						res.status(200).json({
																							status: 0,
																							message: err.message,
																						});
																					});
																			}
																		}
																	);
																}
															}
														);
													}
												});
											}
										});
									}
								}
							);
						}
					});
				}
			});
		}
	});
};
