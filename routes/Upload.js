const express = require("express");
const router = express.Router();
const Bank = require("../models/Bank");
const Infra = require("../models/Infra");
const IncomingForm = require("formidable").IncomingForm;
const fs = require("fs-extra");
const config = require("../config");
const doRequest = require("./utils/doRequest");
const path = require("path");
const jwtTokenAuth = require("./JWTTokenAuth");
const getTypeClass = require("./utils/getTypeClass");
const { errorMessage, catchError } = require("./utils/errorHandler");

router.get("/uploads/:id/:filePath", (req, res) => {
	const id = req.params.id;
	const file_path = req.params.filePath;
	try {
		res.sendFile(config.uploadPath + id + "/" + file_path);
	} catch (err) {
		console.log(err);
		var message = err;
		if (err.message) {
			message = err.message;
		}
		res.status(200).json({
			status: 0,
			message: message,
		});
	}
});

router.post("/fileUpload", jwtTokenAuth, function (req, res) {
	const from = req.query.from;

	let table = Infra;
	if (from && from === "bank") {
		table = Bank;
	}
	const jwtusername = req.sign_creds.username;
	table.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let form = new IncomingForm();
				if (!fs.existsSync(config.uploadPath)) {
					fs.mkdirSync(config.uploadPath);
				}
				const dir = path.resolve(config.uploadPath + user._id);
				form.parse(req, function (err, fields, files) {
					if (err) {
						res.status(200).json(catchError(err));
					} else {
						let fn = files.file.name.split(".").pop();
						fn = fn.toLowerCase();

						if (fn !== "jpeg" && fn !== "png" && fn !== "jpg") {
							res.status(200).json({
								status: 0,
								message: "Only JPG / PNG files are accepted",
							});
						} else {
							if (!fs.existsSync(dir)) {
								fs.mkdirSync(dir);
							}

							let oldpath = files.file.path;
							let newpath = dir + "/" + files.file.name;
							let savepath = user._id + "/" + files.file.name;

							fs.readFile(oldpath, function (err, data) {
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
									fs.writeFile(newpath, data, function (err) {
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
												name: savepath,
											});
										}
									});

									fs.unlink(oldpath, function (err) {});
								}
							});
						}
					}
				});
			}
		}
	);
});

router.post("/:user/imageUpload", jwtTokenAuth, function (req, res) {
	const user = req.params.user;
	const username = req.sign_creds.username;
	const Type = getTypeClass(user);
	Type.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let form = new IncomingForm();
				if (!fs.existsSync(config.uploadPath)) {
					fs.mkdirSync(config.uploadPath);
				}
				const dir = path.resolve(config.uploadPath + user._id);
				form.parse(req, function (err, fields, files) {
					let fn = files.file.name.split(".").pop();
					fn = fn.toLowerCase();

					if (fn !== "jpeg" && fn !== "png" && fn !== "jpg") {
						res.status(200).json({
							status: 0,
							message: "Only JPG / PNG files are accepted",
						});
					} else {
						if (!fs.existsSync(dir)) {
							fs.mkdirSync(dir);
						}

						let oldpath = files.file.path;
						let newpath = dir + "/" + files.file.name;
						let savepath = user._id + "/" + files.file.name;

						fs.readFile(oldpath, function (err, data) {
							if (err) {
								res.status(200).json({
									status: 0,
									message: "File upload error",
								});
							} else {
								fs.writeFile(newpath, data, function (err) {
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
											name: savepath,
										});
									}
								});
							}

							fs.unlink(oldpath, function (err) {});
						});
					}
				});
			}
		}
	);
});

router.post("/ipfsUpload", function (req, res) {
	var form = new IncomingForm();

	form.parse(req, function (_err, _fields, files) {
		// var fn = files.file.name.split('.').pop()
		// fn = fn.toLowerCase()

		// if (fn != 'pdf') {
		//   res.status(200).json({
		// 	message: 'Only PDF files are accepted'
		//   })
		// }
		// else {

		var oldpath = files.file.path;
		fileUpload(oldpath)
			.then(function (result) {
				// var out
				if (result) {
					result = JSON.parse(result);
					if (!result.Hash) {
						res.status(200).json({
							status: 0,
							message: "File Upload Error",
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "File uploaded successfully",
							hash: result.Hash,
						});
					}
				} else {
					res.status(200).json({
						status: 0,
						message: "File Upload Error",
					});
				}
			})
			.catch((err) => {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: err.message,
				});
			});
		// }
	});
});

async function fileUpload(path) {
	const options = {
		method: "POST",
		uri: "http://" + config.ipfsIP + ":5001/api/v0/add",
		headers: {
			"Content-Type": "multipart/form-data",
		},
		formData: {
			file: fs.createReadStream(path),
		},
	};
	try {
		let res = await doRequest(options);
		return res;
	} catch (err) {
		throw err;
	}
}

module.exports = router;
