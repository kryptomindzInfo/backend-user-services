//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { jwtAuthentication } = require("./utils");

//services
const stateUpd = require("../transactions/services/states");

//constants
const stateNames = require("../transactions/constants/stateNames");

//models
const TxState = require("../../models/TxState");

// transactions
const cancelTransaction = require("../transactions/intraBank/cancelTransaction");

module.exports.cancelTransaction = async function (req, res, next) {
	const { transaction_id } = req.body;
	let user = req.params.user;
	jwtAuthentication(user, req, function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.findById(transaction_id, async (err, txstate) => {
				let errMsg = errorMessage(err, txstate, "Transaction not found");
				if (errMsg.status == 0) {
					res.status(200).json(errMsg);
				} else if (txstate.state == stateNames.DONE) {
					res.status(200).json({
						status: 0,
						message:
							"The money is already claimed. The transaction can not be cancelled.",
					});
				} else if (txstate.state == stateNames.CANCEL) {
					res.status(200).json({
						status: 0,
						message: "The transaction is already cancelled.",
					});
				} else if (txstate.cancel.approved == 0) {
					res.status(200).json({
						status: 0,
						message: "Transaction is not sent for approval",
					});
				} else if (txstate.cancel.approved == -1) {
					res.status(200).json({
						status: 0,
						message: "Cancel request is rejected.",
					});
				} else if (txstate.cancel.approved == 2) {
					res.status(200).json({
						status: 0,
						message: "The request is not approved yet.",
					});
				} else if (txstate.state == stateNames.WAIT) {
					try {
						let result = await cancelTransaction.revertOnlyAmount(txstate);
						if (result.status == 1) {
							stateUpd.cancelled(categoryConst.MAIN, transaction_id);
						} else {
							stateUpd.failed(categoryConst.MAIN, transaction_id);
						}
						res.status(200).json(result);
					} catch (err) {
						res.status(200).json(catchError(err));
					}
				} else {
					res.status(200).json({
						status: 0,
						message:
							"The state in which transaction is in does not allow it to cancel. Please check with the administrator.",
					});
				}
			});
		}
	});
};

module.exports.sendForApproval = async function (req, res, next) {
	const { transaction_id } = req.body;
	let user = req.params.user;
	jwtAuthentication(user, req, function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.findOneAndUpdate(
				{ _id: transaction_id, "cancel.approved": 0 },
				{
					$set: {
						cancel: { approved: 2 },
					},
				},
				(err, txstate) => {
					let errMsg = errorMessage(
						err,
						txstate,
						"Transaction is either already sent for approval or may be it is already approved or rejected. Please check the transaction status first."
					);
					if (errMsg.status == 0) {
						res.status(200).json(errMsg);
					} else {
						res.status(200).json({
							status: 1,
							message: "Sent for approval to branch Admin successfully",
						});
					}
				}
			);
		}
	});
};

module.exports.checkApprovalStatus = async function (req, res, next) {
	const { transaction_id } = req.body;
	let user = req.params.user;
	jwtAuthentication(user, req, function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.findOne({ _id: transaction_id }, (err, txstate) => {
				let errRes = errorMessage(err, txstate, "Transaction not found");
				if (errRes.status == 0) {
					res.status(200).json(errRes);
				} else {
					res.status(200).json({
						status: 1,
						message: "Check Approval status",
						txstate: txstate,
					});
				}
			});
		}
	});
};
