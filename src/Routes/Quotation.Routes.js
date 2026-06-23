const express = require("express");
const router = express.Router();
const quotationController = require("../Controllers/Quotation.controllers");
const { adminOnly } = require("../Middlewares/auth.middleware");

router.post("/create", quotationController.createQuotation); // Allow guest users to submit quotation
router.get("/all", adminOnly, quotationController.getAllQuotations);
router.get("/get/:id", adminOnly, quotationController.getQuotationById);
router.put("/update/:id", adminOnly, quotationController.updateQuotation);
router.delete("/delete/:id", adminOnly, quotationController.deleteQuotation);

module.exports = router;
