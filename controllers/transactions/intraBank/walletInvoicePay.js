//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../services/states");
const execute = require("../services/execute.js");
const queueName = require("../constants/queueName.js");

module.exports = async function (
	transfer,
	infra,
	bank,
	user,
	merchant,
	fee,
	comm
) {
	try {
		// receiver's wallet names
		const userWallet = user.wallet_id;
		const merchantOpWallet = merchant.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;

		transfer = getAllShares(transfer, fee, comm);

		// check branch operational wallet balance
		let balance = await blockchain.getBalance(userWallet);
		if (Number(balance) < transfer.amount + transfer.bankFee) {
			return {
				status: 0,
				message: "Not enough balance. Recharge Your wallet.",
			};
		}

		let trans = [
			{
				from: userWallet,
				to: merchantOpWallet,
				amount: transfer.amount,
				note: "Bill amount",
				email1: user.email,
				email2: merchant.email,
				mobile1: user.mobile,
				mobile2: merchant.mobile,
				from_name: user.name,
				to_name: merchant.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p1",
				created_at: new Date(),
			},
		];

		if (transfer.bankFee > 0) {
			trans.push([
				{
					from: userWallet,
					to: bankOpWallet,
					amount: transfer.bankFee,
					note: "Bank fee on paid bill",
					email1: user.email,
					email2: bank.email,
					mobile1: user.mobile,
					mobile2: bank.mobile,
					from_name: user.name,
					to_name: bank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + "-p2",
					created_at: new Date(),
				},
			]);
		}

		if (transfer.bankComm > 0) {
			trans.push([
				{
					from: merchantOpWallet,
					to: bankOpWallet,
					amount: transfer.bankComm,
					note: "Bank commission on paid bill",
					email1: merchant.email,
					email2: bank.email,
					mobile1: merchant.mobile,
					mobile2: bank.mobile,
					from_name: merchant.name,
					to_name: bank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + "-p5",
					created_at: new Date(),
				},
			]);
		}

		// return response
		if (res.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: res.message,
			};
		}

		distributeRevenue(transfer, infra, bank, fee, comm);

		return {
			status: 1,
			message: "Transaction success!",
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, fee, comm) {
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let allTxSuccess = true;

	if (transfer.infraFeeShare.percentage_amount) {
		let trans31 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraFeeShare.percentage_amount,
				note: "Percentage Fee on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p3",
				created_at: new Date(),
			},
		];

		let res = await execute(trans31, queueName.infra_percent);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (transfer.infraFeeShare.fixed_amount > 0) {
		let trans32 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraFeeShare.fixed_amount,
				note: "Fixed Fee on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p4",
				created_at: new Date(),
			},
		];

		let res = await execute(trans32, queueName.infra_fixed);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (transfer.infraCommShare.percentage_amount > 0) {
		let trans6 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraCommShare.percentage_amount,
				note: "Percentage Commission share on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p6",
				created_at: new Date(),
			},
		];

		let res = await execute(trans6, queueName.infra_percent);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}
	if (transfer.infraCommShare.fixed_amount > 0) {
		let trans6 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraCommShare.fixed_amount,
				note: "Fixed Commission on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p7",
				created_at: new Date(),
			},
		];

		let res = await execute(trans6, queueName.infra_fixed);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (allTxSuccess) {
		transferToMasterWallets(transfer, infra, bank);
	}
}

async function transferToMasterWallets(transfer, infra, bank) {
	const bankOpWallet = bank.wallet_ids.operational;
	const bankMasterWallet = bank.wallet_ids.master;
	const infraOpWallet = bank.wallet_ids.infra_operational;
	const infraMasterWallet = bank.wallet_ids.infra_master;

	let master_code = transfer.master_code;

	let infraPart =
		transfer.infraFeeShare.percentage_amount +
		transfer.infraFeeShare.fixed_amount +
		transfer.infraCommShare.percentage_amount +
		transfer.infraCommShare.fixed_amount;
	let bankPart =
		transfer.bankFee +
		transfer.bankComm -
		transfer.infraFeeShare.percentage_amount -
		transfer.infraCommShare.percentage_amount;

	let trans = [
		{
			from: bankOpWallet,
			to: bankMasterWallet,
			amount: bankPart,
			note: "Bank share to its Master Wallet",
			email1: bank.email,
			mobile1: bank.mobile,
			from_name: bank.name,
			to_name: bank.name,
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "-m1",
			created_at: new Date(),
		},
	];
	execute(trans, queueName.bank_master);

	trans = [
		{
			from: infraOpWallet,
			to: infraMasterWallet,
			amount: infraPart,
			note: "Infra share to its Master Wallet",
			email1: infra.email,
			mobile1: infra.mobile,
			from_name: infra.name,
			to_name: infra.name,
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "-m2",
			created_at: new Date(),
		},
	];
	execute(trans, queueName.infra_master);
}

function getAllShares(transfer, feeRule, commRule) {
	let amount = transfer.amount;
	let bankFee = calculateShare("bank", amount, feeRule);
	let bankComm = calculateShare("bank", amount, commRule);
	let infraFeeShare = calculateShare("infra", amount, feeRule);
	let infraCommShare = calculateShare("infra", amount, commRule);

	transfer.bankFee = bankFee;
	transfer.bankComm = bankComm;
	transfer.infraFeeShare = infraFeeShare;
	transfer.infraCommShare = infraCommShare;
	return transfer;
}
