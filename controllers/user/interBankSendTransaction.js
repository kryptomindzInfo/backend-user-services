//utils
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const makeid = require("../../routes/utils/idGenerator");
const makeotp = require("../../routes/utils/makeotp");
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

const addCashierSendRecord = require("../utils/addSendRecord");

//models
const User = require("../../models/User");
const NWUser = require("../../models/NonWalletUsers");
const Bank = require("../../models/Bank");
const Infra = require("../../models/Infra");
const Fee = require("../../models/Fee");
const CashierSend = require("../../models/CashierSend");

// transactions
const txstate = require("../transactions/services/states");
const walletToWallet = require("../transactions/interBank/walletToWallet");
const walletToCashier = require("../transactions/interBank/walletToCashier");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.sendMoneyToNonWallet = function (req, res) {
	const username = req.sign_creds.username;

	const {
		note,
		withoutID,
		requireOTP,
		receiverMobile,
		receiverGivenName,
		receiverFamilyName,
		receiverCountry,
		receiverEmail,
		receiverIdentificationType,
		receiverIdentificationNumber,
		receiverIdentificationValidTill,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	User.findOneAndUpdate(
		{
			username,
			status: 1,
		},
		{
			$addToSet: {
				contact_list: receiverMobile,
			},
		},
		async function (err, sender) {
			let result1 = errorMessage(err, sender, "Sender not found");
			if (result1.status == 0) {
				res.status(200).json(result1);
			} else {
				// Initiate transaction
				const master_code = await txstate.initiate(
					sender.bank_id,
					"Inter Bank Wallet To Non Wallet"
				);
				var receiver = {
					name: receiverGivenName,
					last_name: receiverFamilyName,
					mobile: receiverMobile,
					email: receiverEmail,
					country: receiverCountry,
				};
				try {
					const bank = await Bank.findOne({
						_id: sender.bank_id,
					});
					if (bank == null) {
						throw new Error("Bank not found");
					}

					const infra = await Infra.findOne({
						_id: bank.user_id,
					});
					if (infra == null) {
						throw new Error("Infra not found");
					}
					const find = {
						bank_id: bank._id,
						type: "IBWNW",
						status: 1,
						active: 1,
					};
					const rule = await InterBankRule.findOne(find);
					if (rule == null) {
						throw new Error("Rule not found");
					}

					let data = new CashierSend();
					temp = {
						mobile: sender.mobile,
						note: note,
						givenname: sender.name,
						familyname: sender.last_name,
						address1: sender.address,
						state: sender.state,
						country: sender.country,
						email: sender.email,
					};
					data.sender_info = temp;
					temp = {
						mobile: receiverMobile,
						// ccode: receiverccode,
						givenname: receiverGivenName,
						familyname: receiverFamilyName,
						country: receiverCountry,
						email: receiverEmail,
					};
					data.receiver_info = temp;
					temp = {
						country: receiverCountry,
						type: receiverIdentificationType,
						number: receiverIdentificationNumber,
						valid: receiverIdentificationValidTill,
					};
					data.receiver_id = temp;
					data.amount = receiverIdentificationAmount;
					data.is_inclusive = isInclusive;
					const transactionCode = makeid(8);
					data.transaction_code = transactionCode;
					data.rule_type = "Wallet to Non Wallet";
					data.sending_bank_id = bank._id;
					data.inter_bank_rule_type = "IBWNW";
					data.is_inter_bank = 1;
					data.master_code = master_code;

					data.without_id = withoutID ? 1 : 0;
					if (requireOTP) {
						data.require_otp = 1;
						data.otp = makeotp(6);
						content = data.otp + " - Send this OTP to the Receiver";
						if (sender.mobile && sender.mobile != null) {
							sendSMS(content, sender.mobile);
						}
						if (sender.email && sender.email != null) {
							sendMail(content, "Transaction OTP", receiver.email);
						}
					}

					//send transaction sms after actual transaction

					var cs = await data.save();

					var transfer = {
						master_code: master_code,
						amount: receiverIdentificationAmount,
						isInclusive: isInclusive,
						receiverFamilyName: receiverFamilyName,
					};
					var result = await walletToCashier(
						transfer,
						infra,
						bank,
						sender,
						rule
					);
					console.log("Result: " + result);
					if (result.status != 0) {
						let content = "Your Transaction Code is " + transactionCode;
						if (receiverMobile && receiverMobile != null) {
							sendSMS(content, receiverMobile);
						}
						if (receiverEmail && receiverEmail != null) {
							sendMail(content, "Transaction Code", receiverEmail);
						}

						const caSend = await CashierSend.findByIdAndUpdate(cs._id, {
							status: 1,
							fee: result.fee,
						});
						if (caSend == null) {
							throw new Error("Cashier send record not found");
						}

						NWUser.create(receiver);
						await txstate.waitingForCompletion(master_code);
						res.status(200).json({
							status: 1,
							message:
								receiverIdentificationAmount + " XOF is transferred to branch",
							balance: result.balance - (result.amount + result.fee),
						});
					} else {
						res.status(200).json({
							status: 0,
							message: result.toString(),
						});
					}
				} catch (err) {
					console.log(err);
					var message = err.toString();
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({ status: 0, message: message });
				}
			}
		}
	);
};

module.exports.sendMoneyToWallet = async function (req, res) {
	const username = req.sign_creds.username;

	const { receiverMobile, note, sending_amount, isInclusive } = req.body;

	try {
		const sender = await User.findOneAndUpdate(
			{
				username,
				status: 1,
			},
			{
				$addToSet: {
					contact_list: receiverMobile,
				},
			}
		);
		if (sender == null) {
			throw new Error(
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
		}

		// Initiate transaction
		const master_code = await txstate.initiate(
			sender.bank_id,
			"Inter Bank Wallet To Wallet"
		);

		const receiver = await User.findOne({
			mobile: receiverMobile,
		});
		if (receiver == null) {
			throw new Error("Receiver's wallet do not exist");
		}

		const bank = await Bank.findOne({
			_id: sender.bank_id,
		});
		if (bank == null) {
			throw new Error("Bank Not Found");
		}

		const receiverBank = await Bank.findOne({ _id: receiver.bank_id });
		if (receiverBank == null) {
			throw new Error("Receiver Bank Not Found");
		}

		const infra = await Infra.findOne({
			_id: bank.user_id,
		});
		if (infra == null) {
			throw new Error("Infra Not Found");
		}
		const find = {
			bank_id: bank._id,
			type: "IBWW",
			status: 1,
			active: 1,
		};
		const rule1 = await InterBankRule.findOne(find);
		if (rule1 == null) {
			throw new Error("Inter Bank Rule Not Found");
		}

		const transfer = {
			master_code: master_code,
			amount: sending_amount,
			isInclusive: isInclusive,
			note: note,
		};
		const result1 = await walletToWallet(
			transfer,
			infra,
			bank,
			receiverBank,
			sender,
			receiver,
			rule1
		);
		console.log("Result: " + result1);
		if (result1.status == 1) {
			await txstate.completed(master_code);
			res.status(200).json({
				status: 1,
				message: sending_amount + " XOF is transferred to " + receiver.name,
				balance: result1.balance - (result1.amount + result1.fee),
			});
		} else {
			res.status(200).json({
				status: 0,
				message: result1.toString(),
			});
		}
	} catch (err) {
		console.log(err);
		var message = err.toString();
		if (err && err.message) {
			message = err.message;
		}
		res.status(200).json({
			status: 0,
			message: message,
		});
	}
};
