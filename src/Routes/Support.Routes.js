const express = require("express");
const router = express.Router();
const supportControllers = require("../Controllers/Support.controllers");
const { adminOnly } = require("../Middlewares/auth.middleware");

router.get("/all", adminOnly, supportControllers.getAllTickets);
router.post("/create", supportControllers.createTicket); // Allow users to create support tickets without auth
router.put("/update/:id", adminOnly, supportControllers.updateTicketStatus);

module.exports = router;
