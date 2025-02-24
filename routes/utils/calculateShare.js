module.exports.getTransactionCode = function (data1, data2) {
	var slice1 = data1.slice(-2);
	var slice2 = data2.slice(-2);
	var now = new Date().getTime();
	return slice1 + "" + slice2 + "" + now;
};

module.exports.calculateShare = function (
	calculate,
	amount,
	rule,
	rule2 = {},
	sharerCode = ""
) {
	console.log("**********Calculating " + calculate + " share for amount " + amount + " **********")
	console.log(rule);
	var ranges = rule.ranges;
	var bankRule = ranges.filter(
		(range) => amount >= range.trans_from && amount <= range.trans_to
	)[0];
	if (!bankRule) {
		return 0;
	}
	var temp = (amount * bankRule.percentage) / 100;
	var bankFee = temp + bankRule.fixed;
	console.log("Bank Fee: ", bankFee);

	var infra_share;
	if (rule.revenue_sharing_rule) {
		infra_share = rule.revenue_sharing_rule.infra_share;
	} else {
		infra_share = rule.infra_share;
	}
	var infraShare = {};
	infraShare.percentage_amount = (bankFee * Number(infra_share.percentage)) / 100;
	infraShare.fixed_amount = Number(infra_share.fixed);
	console.log("Infra Share: ", infraShare);

	var otherBankShare = {
		percentage_amount: 0,
		fixed_amount: 0
	};
	var bankBShare = 0;
	if (rule.other_bank_share && rule.other_bank_share.percentage > 0) {
		otherBankShare.percentage_amount = (bankFee * Number(rule.other_bank_share.percentage)) / 100;
		console.log("Other bank percentage amount: ", otherBankShare.percentage_amount)
		bankBShare = bankBShare + otherBankShare.percentage_amount;
	}
	if (rule.other_bank_share && rule.other_bank_share.fixed > 0) {
		otherBankShare.fixed_amount = Number(rule.other_bank_share.fixed) / 100;
		console.log("Other bank fixed amount: ", otherBankShare.fixed_amount);
		bankBShare = bankBShare + otherBankShare.fixed_amount;
	}

	var bankShare = bankFee - infraShare.percentage_amount - otherBankShare.percentage_amount;
	console.log("Bank Share: ", bankShare);
	switch (calculate) {
		case "bank":
			return bankFee;
		case "infra":
			return infraShare;
		case "claimBranch":
			if (rule2.revenue_sharing_rule && rule2.revenue_sharing_rule.branch_share) {
				rule = rule2
				bankShare = bankBShare;
			}
			console.log(rule.revenue_sharing_rule.branch_share);
			console.log(rule.revenue_sharing_rule.specific_branch_share)
			var branchRule = rule.revenue_sharing_rule.branch_share;
			if (rule.revenue_sharing_rule.specific_branch_share && rule.revenue_sharing_rule.specific_branch_share.length > 0) {
				var specificBranchRule = rule.revenue_sharing_rule.specific_branch_share.filter(
					(specific_brule) => specific_brule.branch_code == sharerCode
				)[0];
			}
			if (specificBranchRule) {
				branchRule = specificBranchRule
			}
			var { claim } = branchRule;
			var claimFee = (claim * bankShare) / 100;
			console.log("Claiming Branch Share: ", claimFee);
			return claimFee;
		case "sendBranch":
			if (rule2.revenue_sharing_rule && rule2.revenue_sharing_rule.branch_share) {
				rule = rule2
			}
			console.log(rule.revenue_sharing_rule.branch_share);
			console.log(rule.revenue_sharing_rule.specific_branch_share)
			var branchRule = rule.revenue_sharing_rule.branch_share;
			if (rule.revenue_sharing_rule.specific_branch_share && rule.revenue_sharing_rule.specific_branch_share.length > 0) {
				var specificBranchRule = rule.revenue_sharing_rule.specific_branch_share.filter(
					(specific_brule) => specific_brule.branch_code == sharerCode
				)[0];
			}
			if (specificBranchRule) {
				branchRule = specificBranchRule
			}
			var { send } = branchRule;
			var sendFee = (Number(send) * bankShare) / 100;
			console.log("Sending Branch Share: ", sendFee);
			return sendFee;
		case "claimPartner":
			if (rule2.revenue_sharing_rule && rule2.revenue_sharing_rule.partner_share) {
				rule = rule2
				bankShare = bankBShare;
			}
			console.log(rule.revenue_sharing_rule.partner_share);
			console.log(rule.revenue_sharing_rule.specific_partner_share)
			var partnerRule = rule.revenue_sharing_rule.partner_share;
			if (rule.revenue_sharing_rule.specific_partner_share && rule.revenue_sharing_rule.specific_partner_share.length > 0) {
				var specificPartnerRule = rule.revenue_sharing_rule.specific_partner_share.filter(
					(specific_brule) => specific_brule.partner_code == sharerCode
				)[0];
			}
			if (specificPartnerRule) {
				partnerRule = specificPartnerRule
			}
			var { claim } = partnerRule;
			var claimFee = (claim * bankShare) / 100;
			console.log("Claiming Partner Share: ", claimFee);
			return claimFee;
		case "sendPartner":
			if (rule2.revenue_sharing_rule && rule2.revenue_sharing_rule.partner_share) {
				rule = rule2
			}
			console.log(rule.revenue_sharing_rule.partner_share);
			console.log(rule.revenue_sharing_rule.specific_partner_share)
			var partnerRule = rule.revenue_sharing_rule.partner_share;
			if (rule.revenue_sharing_rule.specific_partner_share && rule.revenue_sharing_rule.specific_partner_share.length > 0) {
				var specificPartnerRule = rule.revenue_sharing_rule.specific_partner_share.filter(
					(specific_brule) => specific_brule.partner_code == sharerCode
				)[0];
			}
			if (specificPartnerRule) {
				partnerRule = specificPartnerRule
			}
			var { send } = partnerRule;
			var sendFee = (Number(send) * bankShare) / 100;
			console.log("Sending Partner Share: ", sendFee);
			return sendFee;
		case "branch":
			if (rule2.branch_share) {
				rule = rule2
			}
			console.log(rule.branch_share);
			console.log(rule.specific_branch_share)
			var percent = rule.branch_share;
			if (rule.specific_branch_share && rule.specific_branch_share.length > 0) {
				var branchRule = rule.specific_branch_share.filter(
					(specific_brule) => specific_brule.code == sharerCode
				)[0];
				if (branchRule) {
					percent = branchRule.percentage;
				}
			}
			var branchFee = (percent * bankShare) / 100;
			console.log("Bank Branch Share : ", branchFee);
			return branchFee;
		case "partner":
			if (rule2.partner_share) {
				rule = rule2
			}
			console.log(rule.partner_share);
			console.log(rule.specific_partner_share)
			var percent = rule.partner_share;
			if (rule.specific_partner_share && rule.specific_partner_share.length > 0) {
				var partnerBRule = rule.specific_partner_share.filter(
					(specific_pbrule) => specific_pbrule.code == sharerCode
				)[0];
				if (partnerBRule) {
					percent = partnerBRule.percentage;
				}
			}
			var partnerFee = (percent * bankShare) / 100;
			console.log("Merchant's Partner Branch Share: ", partnerFee);
			return partnerFee;
		case "claimBank":
			return otherBankShare;
	}
};
