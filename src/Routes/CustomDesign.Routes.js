const express = require("express");
const router = express.Router();
const customDesignController = require("../Controllers/CustomDesign.controllers");
const upload = require("../Middlewares/multer.middleware");

router.get("/all", customDesignController.getAllCustomDesigns);
router.get("/get/:id", customDesignController.getCustomDesignById);
router.post("/create", upload.single("referenceImage"), customDesignController.createCustomDesign);
router.put("/update/:id", upload.single("referenceImage"), customDesignController.updateCustomDesign);
router.put("/status/:id", customDesignController.updateCustomDesignStatus);
router.delete("/delete/:id", customDesignController.deleteCustomDesign);

module.exports = router;
