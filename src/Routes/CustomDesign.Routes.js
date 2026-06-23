const express = require("express");
const router = express.Router();
const customDesignController = require("../Controllers/CustomDesign.controllers");
const upload = require("../Middlewares/multer.middleware");
const { adminOnly } = require("../Middlewares/auth.middleware");

router.get("/all", adminOnly, customDesignController.getAllCustomDesigns);
router.get("/get/:id", adminOnly, customDesignController.getCustomDesignById);
router.post("/create", upload.single("referenceImage"), customDesignController.createCustomDesign);
router.put("/update/:id", adminOnly, upload.single("referenceImage"), customDesignController.updateCustomDesign);
router.put("/status/:id", adminOnly, customDesignController.updateCustomDesignStatus);
router.delete("/delete/:id", adminOnly, customDesignController.deleteCustomDesign);

module.exports = router;
