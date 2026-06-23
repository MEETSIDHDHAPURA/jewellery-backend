const DelayedCouponQueue = require("../Models/DelayedCouponQueue.Model");
const Coupon = require("../Models/Coupon.Model");
const sendMail = require("./Nodemailer");

const startDelayedCouponWorker = () => {
  // Run every 1 minute to check for coupons scheduled to be sent
  setInterval(async () => {
    try {
      const now = new Date();
      const pendingJobs = await DelayedCouponQueue.find({
        status: "pending",
        scheduledTime: { $lte: now }
      }).populate("coupon").populate("user");

      for (const job of pendingJobs) {
        try {
          if (!job.coupon || !job.coupon.isActive) {
            job.status = "failed";
            job.error = "Coupon is inactive or deleted";
            await job.save();
            continue;
          }

          const message = `
            <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #d4af37; text-align: center; font-family: serif;">Welcome to Praya Diamonds!</h2>
              <p>Hello ${job.user?.name || "there"},</p>
              <p>Thank you for creating an account with us! As a token of our appreciation, here is an exclusive welcome discount coupon code for your first purchase:</p>
              <div style="background-color: #fcf9f2; border: 2px dashed #d4af37; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0; border-radius: 5px; color: #111;">
                ${job.coupon.code}
              </div>
              <p style="color: #555; font-size: 14px; text-align: center;"><strong>Offer details:</strong> ${job.coupon.description || "Exclusive welcome discount"}</p>
              <p style="color: #888; font-size: 12px; text-align: center; margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">This coupon code is valid until ${new Date(job.coupon.expiryDate).toLocaleDateString()}. Thank you for choosing us.</p>
            </div>
          `;

          await sendMail(job.email, "Your Exclusive Welcome Discount Coupon!", message);

          job.status = "sent";
          await job.save();
        } catch (err) {
          job.status = "failed";
          job.error = err.message || "Unknown error";
          await job.save();
          console.error("Error processing delayed coupon job:", err);
        }
      }
    } catch (err) {
      console.error("Delayed coupon worker error:", err);
    }
  }, 60 * 1000); // 1 minute
};

module.exports = startDelayedCouponWorker;
