//services
const blockchain = require("../../../services/Blockchain.js");
const { getTransactionCode, calculateShare } = require("../../utils/calculateShare");

module.exports = async function (
    transfer,
    infra,
    bank,
    branch,
    rule1,
    rule2
) {
    try {
        const branchOpWallet = branch.wallet_ids.operational;
        const bankEsWallet = bank.wallet_ids.escrow;
        const bankOpWallet = bank.wallet_ids.operational;

        // first transaction
        var amount = Number(transfer.amount);
        var fee = calculateShare("bank", transfer.amount, rule1);
        if (transfer.isInclusive) {
            amount = amount - fee;
        }

        var balance = await blockchain.getBalance(branchOpWallet);

        //Check balance first
        if (
            Number(balance) +
            Number(branch.credit_limit) <
            amount + fee
        ) {
            throw new Error("Not enough balance in partner branch operational wallet");

        }

        let master_code = getTransactionCode(branch.mobile, bank.mobile)

        let trans1 = {
            from: branchOpWallet,
            to: bankEsWallet,
            amount: amount,
            note: "Partner Cashier Send Money to Non Wallet of Inter Bank",
            email1: branch.email,
            email2: bank.email,
            mobile1: branch.mobile,
            mobile2: bank.mobile,
            from_name: branch.name,
            to_name: bank.name,
            user_id: transfer.cashierId,
            master_code: master_code,
            child_code: master_code
        }

        var result = await blockchain.initiateTransfer(trans1);

        // return response
        if (result.status == 0) {
            return {
                status: 0,
                message: "Transaction failed!",
                blockchain_message: result.message,
            };
        }
        var sendingPartnerShare = 0;
        if (fee > 0) {
            let trans2 = {
                from: branchOpWallet,
                to: bankOpWallet,
                amount: fee,
                note: "Cashier Send Fee for Inter Bank Non Wallet to Non Wallet Transaction",
                email1: branch.email,
                email2: bank.email,
                mobile1: branch.mobile,
                mobile2: bank.mobile,
                from_name: branch.name,
                to_name: bank.name,
                user_id: transfer.cashierId,
                master_code: master_code,
                child_code: master_code + "1"
            }

            await blockchain.initiateTransfer(trans2);

            sendingPartnerShare = calculateShare("sendPartner", amount, rule1, rule2, transfer.partnerCode);
            transfer.sendingPartnerShare = sendingPartnerShare;
        }
        transfer.fee = fee;
        transfer.master_code = master_code;
        distributeRevenue(
            transfer,
            infra,
            bank,
            branch,
            rule1
        );
        return {
            status: 1,
            message: "Transaction success!",
            blockchain_message: result.message,
            amount: amount,
            fee: fee,
            sendFee: sendingPartnerShare,
            master_code: master_code
        };
    } catch (err) {
        throw err;
    }

}

async function distributeRevenue(transfer,
    infra,
    bank,
    branch,
    rule1) {
    const branchOpWallet = branch.wallet_ids.operational;
    const bankOpWallet = bank.wallet_ids.operational;
    const infraOpWallet = bank.wallet_ids.infra_operational;

    var infraShare = calculateShare("infra", transfer.amount, rule1);
    if (infraShare.percentage_amount > 0) {
        let trans21 = {
            from: bankOpWallet,
            to: infraOpWallet,
            amount: infraShare.percentage_amount,
            note: "Bank Send Infra Percentage amount for Inter Bank Non Wallet to Non Wallet transaction",
            email1: branch.email,
            email2: infra.email,
            mobile1: branch.mobile,
            mobile2: infra.mobile,
            from_name: branch.name,
            to_name: infra.name,
            user_id: "",
            master_code: transfer.master_code,
            child_code: transfer.master_code + "2.1",
        }

        await blockchain.initiateTransfer(trans21);
    }
    if (infraShare.fixed_amount > 0) {
        let trans22 = {
            from: bankOpWallet,
            to: infraOpWallet,
            amount: infraShare.fixed_amount,
            note: "Bank Send Infra Fixed amount for Inter Bank Non Wallet to Non Wallet transaction",
            email1: bank.email,
            email2: infra.email,
            mobile1: bank.mobile,
            mobile2: infra.mobile,
            from_name: bank.name,
            to_name: infra.name,
            user_id: "",
            master_code: transfer.master_code,
            child_code: transfer.master_code + "2.2",
        }

        await blockchain.initiateTransfer(trans22);
    }

    console.log("fee: ", transfer.fee)

    if (transfer.fee > 0) {
        console.log("branch transaction")
        let trans4 = {
            from: bankOpWallet,
            to: branchOpWallet,
            amount: transfer.sendingPartnerShare,
            note: "Bank Send Revenue Share for Sending Money for Inter Bank Non Wallet to Non Wallet transaction",
            email1: bank.email,
            email2: branch.email,
            mobile1: bank.mobile,
            mobile2: branch.mobile,
            from_name: bank.name,
            to_name: branch.name,
            user_id: "",
            master_code: transfer.master_code,
            child_code: transfer.master_code + "3",
        }

        await blockchain.initiateTransfer(trans4);
    }
}