/* If this file is updated, also build docker for receive.js which is a rabbitmq queue receiver*/

const INFRAFIXED = "INFRAFIXED";
const INFRAPERCENT = "INFRAPERCENT";
const INTERBANKFIXED = "INTERBANKFIXED";
const INTERBANKPERCENT = "INTERBANKPERCENT";
const SENDFEE = "SENDFEE";
const CLAIMFEE = "CLAIMFEE";
const BANKMASTER = "BANKMASTER";
const INTERBANKMASTER = "INTERBANKMASTER";
const INFRAMASTER = "INFRAMASTER";
const CLAIMMASTER = "CLAIMMASTER";
const SENDMASTER = "SENDMASTER";
const PARTNERSHARE = "PARTNERSHARE";
const REVERT = "REVERT";

module.exports = {
	INFRA_FIXED: INFRAFIXED,
	INFRA_PERCENT: INFRAPERCENT,
	SEND_FEE: SENDFEE,
	CLAIM_FEE: CLAIMFEE,
	BANK_MASTER: BANKMASTER,
	INTER_BANK_MASTER: INTERBANKMASTER,
	INFRA_MASTER: INFRAMASTER,
	CLAIM_MASTER: CLAIMMASTER,
	SEND_MASTER: SENDMASTER,
	PARTNER_SHARE: PARTNERSHARE,
	REVERT: REVERT,
	INTER_BANK_FIXED: INTERBANKFIXED,
	INTER_BANK_PERCENT: INTERBANKPERCENT,
};
