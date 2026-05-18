const express = require("express");
const router = express.Router();
const supportControllers = require("../Controllers/Support.controllers");

router.get("/all", supportControllers.getAllTickets);
router.post("/create", supportControllers.createTicket);
router.put("/update/:id", supportControllers.updateTicketStatus);

module.exports = router;
