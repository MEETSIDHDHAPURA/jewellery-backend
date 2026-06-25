const Support = require("../Models/Support.Model");

// Get all support tickets with automatic seed if database is empty
exports.getAllTickets = async (req, res) => {
  try {
    const { status, search } = req.query;

    const filter = {};
    if (status && status !== "All") {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { subject: searchRegex },
        { message: searchRegex },
      ];
    }

    let tickets = await Support.find(filter).sort({ createdAt: -1 });

    // Seed dummy tickets ONLY if the search/status filter is empty AND database is empty
    if (tickets.length === 0 && !search && (!status || status === "All")) {
      const existingCount = await Support.countDocuments({});
      if (existingCount === 0) {
        const dummyTickets = [
          {
            name: "Amit Sharma",
            email: "amit.sharma@example.com",
            phone: "+91 98765 43210",
            subject: "Custom Ring Inquiry",
            message:
              "Hi, I am looking to order a customized 18K white gold engagement ring with a 1.5 carat round cut diamond. Could you please share the design catalogs and tell me how much time it would take to manufacture?",
          },
          {
            name: "Priya Patel",
            email: "priya.patel@example.com",
            phone: "+91 87654 32109",
            subject: "Order Delivery Status Delay",
            message:
              "Hello Support Team, my order for the gold solitaire pendant (#ORD-8947) was supposed to arrive yesterday. The tracking link still shows in-transit. Can you please assist?",
          },
          {
            name: "Rajesh Kumar",
            email: "rajesh.kumar@example.com",
            phone: "+91 76543 21098",
            subject: "Certificate of Diamond Authenticity",
            message:
              "Thank you for the fast shipping of the princess cut diamond earrings! I received them today. However, I could not find the physical GIA authenticity certificate inside the package. Could you email me a digital copy or ship the certificate?",
          },
        ];

        await Support.insertMany(dummyTickets);
        tickets = await Support.find().sort({ createdAt: -1 });
      }
    }

    // Aggregate counts for stats cards
    const [totalAll, countPending, countInProgress, countResolved] = await Promise.all([
      Support.countDocuments({}),
      Support.countDocuments({ $or: [{ status: "Pending" }, { status: { $exists: false } }, { status: "" }] }),
      Support.countDocuments({ status: "In Progress" }),
      Support.countDocuments({ status: "Resolved" }),
    ]);

    return res.status(200).json({
      success: true,
      data: tickets,
      counts: {
        total: totalAll,
        pending: countPending,
        inProgress: countInProgress,
        resolved: countResolved,
      }
    });
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching support tickets",
    });
  }
};

// Create a new support ticket
exports.createTicket = async (req, res) => {
  try {
    const { name, email, phone, countryCode, subject, message } = req.body;

    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, subject, and message are required to create a ticket",
      });
    }

    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

    const newTicket = await Support.create({
      name,
      email,
      phone: normalizedPhone,
      countryCode: countryCode || "",
      subject,
      message,
    });

    return res.status(201).json({
      success: true,
      data: newTicket,
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create support ticket",
    });
  }
};

// Update a support ticket status
exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined) {
      return res.status(400).json({
        success: false,
        message: "Status is required to update a support ticket",
      });
    }

    const ticket = await Support.findByIdAndUpdate(
      id,
      { status },
      { returnDocument: "after", runValidators: true }
    );

    if (!ticket) {
      return res.status(444).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Error updating ticket:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update support ticket status",
    });
  }
};
