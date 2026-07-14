const express = require("express");
const router = express.Router();
const { subscribeNewsletter } = require("../Controllers/Newsletter.controllers");

router.post("/subscribe", subscribeNewsletter);

module.exports = router;
