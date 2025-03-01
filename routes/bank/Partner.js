const express = require("express");
const router = express.Router();
const config = require("../../config.json");

//utils
const makeid = require("../utils/idGenerator");
const sendSMS = require("../utils/sendSMS");
const sendMail = require("../utils/sendMail");
const getTypeClass = require("../utils/getTypeClass");
const makeotp = require("../utils/makeotp");

//services
const {
    createWallet,
    getStatement,
    getBalance,
} = require("../../services/Blockchain.js");

const Bank = require("../../models/Bank");
const OTP = require("../../models/OTP");
const Branch = require("../../models/Branch");
const BankUser = require("../../models/BankUser");
const Cashier = require("../../models/Cashier");
const Fee = require("../../models/Fee");
const CashierLedger = require("../../models/CashierLedger");
const Merchant = require("../../models/merchant/Merchant");
const FailedTX = require("../../models/FailedTXLedger");
const Partner = require("../../models/partner/Partner")
const Document = require("../../models/Document");

router.post("/bank/listPartners", function (req, res) {
    const { token } = req.body;
    Bank.findOne(
        {
            token,
            status: 1,
        },
        function (err, bank) {
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                Partner.find({ bank_id: bank._id }, function (err, partner) {
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
                        res.status(200).json({
                            status: 1,
                            partners: partner,
                        });
                    }
                });
            }
        }
    );
});

router.post("/bank/getPartner", function (req, res) {
    const { token, partner_id } = req.body;
    Bank.findOne(
        {
            token,
            status: 1,
        },
        function (err, bank) {
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                Partner.findOne(
                    {
                        _id: partner_id,
                    },
                    function (err, partner) {
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
                        } else if (partner == null) {
                            res.status(200).json({
                                status: 0,
                                message: "Partner not found",
                            });
                        } else {
                            res.status(200).json({
                                status: 1,
                                partners: partner,
                            });
                        }
                    }
                );
            }
        }
    );
});

router.post("/bank/editPartner", (req, res) => {
    const {
        partner_id,
        name,
        bcode,
        address,
        state,
        zip,
        country,
        ccode,
        mobile,
        email,
        token,
        logo,
        contract,
        otp_id,
        otp,
    } = req.body;

    Bank.findOne(
        {
            token,
            status: 1,
        },
        function (err, bank) {
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                OTP.findOne(
                    {
                        _id: otp_id,
                        otp: otp,
                    },
                    function (err, otpd) {
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
                        } else if (otpd == null) {
                            res.status(200).json({
                                status: 0,
                                message: err,
                            });
                        } else {
                            if (otpd.otp === otp) {
                                if (
                                    name === "" ||
                                    address === "" ||
                                    state === "" ||
                                    mobile === "" ||
                                    email === ""
                                ) {
                                    return res.status(200).json({
                                        status: 0,
                                        message: "Please provide valid inputs",
                                    });
                                }
                                Partner.findByIdAndUpdate(
                                    partner_id,
                                    {
                                        name: name,
                                        address: address,
                                        state: state,
                                        zip: zip,
                                        ccode: ccode,
                                        bcode: bcode,
                                        country: country,
                                        mobile: mobile,
                                        email: email,
                                        logo: logo,
                                        contract: contract,
                                    },
                                    { new: true },
                                    (err, partner) => {
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
                                        } else if (!partner) {
                                            res.status(200).json({
                                                status: 0,
                                                message: "partner not found"
                                            })
                                        } else {
                                            Document.update({ partner_id: partner_id }, { contract: contract }, (err) => { });
                                            return res.status(200).json({ status: 1, partner: partner });
                                        }
                                    }
                                );
                            } else {
                                res.status(200).json({
                                    status: 0,
                                    message: "OTP Missmatch",
                                });
                            }
                        }
                    }
                );
            }
        }
    );
});

router.post("/bank/addPartner", (req, res) => {
    let data = new Partner();
    const {
        name,
        code,
        address,
        state,
        zip,
        country,
        ccode,
        mobile,
        email,
        token,
        logo,
        contract,
        otp_id,
        otp,
    } = req.body;
    Bank.findOne(
        {
            token,
            status: 1,
        },
        function (err, bank) {
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                OTP.findOne(
                    {
                        _id: otp_id,
                        otp: otp,
                    },
                    function (err, otpd) {
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
                            if (!otpd) {
                                res.status(200).json({
                                    status: 0,
                                    message: "OTP Missmatch",
                                });
                            } else {
                                if (otpd.otp === otp) {
                                    if (
                                        name === "" ||
                                        address === "" ||
                                        state === "" ||
                                        mobile === "" ||
                                        email === ""
                                    ) {
                                        return res.status(200).json({
                                            status: 0,
                                            message: "Please provide valid inputs",
                                        });
                                    }

                                    data.name = name;
                                    data.code = code;
                                    data.address = address;
                                    data.state = state;
                                    data.country = country;
                                    data.zip = zip;
                                    data.ccode = ccode;
                                    data.mobile = mobile;
                                    data.username = mobile;
                                    data.email = email;
                                    data.bank_id = bank._id;
                                    data.logo = logo;
                                    data.contract = contract;
                                    data.password = makeid(10);

                                    data.save((err, partner) => {
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
                                            let data2 = new Document();
                                            data2.partner_id = partner._id;
                                            data2.contract = contract;
                                            data2.save((err) => { });

                                            let content =
                                                "<p>Your partner is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
                                                config.mainIP +
                                                "/partner'>http://" +
                                                config.mainIP +
                                                "/partner</a></p><p><p>Your username: " +
                                                data.username +
                                                "</p><p>Your password: " +
                                                data.password +
                                                "</p>";
                                            sendMail(content, "Partner Account Created", email);
                                            let content2 =
                                                "Your partner is added in E-Wallet application Login URL: http://" +
                                                config.mainIP +
                                                "/partner Your username: " +
                                                data.username +
                                                " Your password: " +
                                                data.password;
                                            sendSMS(content2, mobile);

                                            return res.status(200).json({ status: 1, partner: data });
                                        }
                                    });
                                } else {
                                    res.status(200).json({
                                        status: 0,
                                        message: "OTP Missmatch",
                                    });
                                }
                            }
                        }
                    }
                );
            }
        }
    );
});

module.exports = router;

