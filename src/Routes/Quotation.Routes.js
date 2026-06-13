const express = require("express");
const router = express.Router();
const quotationController = require("../Controllers/Quotation.controllers");

router.post("/create", quotationController.createQuotation);
router.get("/all", quotationController.getAllQuotations);
router.get("/get/:id", quotationController.getQuotationById);
router.put("/update/:id", quotationController.updateQuotation);
router.delete("/delete/:id", quotationController.deleteQuotation);

module.exports = router;
