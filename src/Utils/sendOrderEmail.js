const Order = require("../Models/Order.Model");
const User = require("../Models/User.Model");
const sendMail = require("./Nodemailer");

const formatEmailPrice = (amountInUsd, currency = 'USD', exchangeRate = 1) => {
  const targetCurrency = (currency || 'USD').toUpperCase();
  const amount = amountInUsd * exchangeRate;
  
  if (targetCurrency === 'INR') {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  } else if (targetCurrency === 'CAD') {
    return `CA$${amount.toFixed(2)}`;
  }
  return `$${amount.toFixed(2)}`;
};

const sendOrderConfirmationEmail = async (orderId) => {
  try {
    const order = await Order.findById(orderId)
      .populate("items.product")
      .populate("items.diamond")
      .populate("user");

    if (!order) {
      console.error(`Order ${orderId} not found for sending confirmation email.`);
      return;
    }

    const userDoc = order.user;
    const customerEmail = userDoc ? userDoc.email : (order.shippingAddress?.email || order.email);
    const customerName = userDoc 
      ? userDoc.name 
      : (order.shippingAddress?.firstName 
          ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName || ''}`.trim() 
          : "Valued Customer");

    const customerPhone = userDoc
      ? userDoc.countryCode
        ? `${userDoc.countryCode} ${userDoc.phone || ''}`.trim()
        : userDoc.phone || ''
      : '';

    if (!customerEmail) {
      console.warn(`No email found for order ${orderId}, skipping email.`);
      return;
    }

    // Build the items list HTML
    let itemsListHtml = "";
    for (const item of order.items) {
      let title = "Untitled Product";
      let variant = "";
      if (item.product) {
        title = item.product.title || "Untitled Product";
      } else if (item.diamond) {
        title = `Loose Diamond - ${item.diamond.shape || ''} ${item.diamond.diamondType || ''}`;
      }

      const parts = [];
      if (item.variantDetails) {
        if (item.variantDetails.metal) parts.push(item.variantDetails.metal);
        if (item.variantDetails.carat) parts.push(item.variantDetails.carat);
        if (item.variantDetails.clarity) parts.push(item.variantDetails.clarity);
        if (item.variantDetails.color) parts.push(item.variantDetails.color);
        if (item.variantDetails.size) parts.push(`Size ${item.variantDetails.size}`);
      }
      variant = parts.join(" · ") || "Standard";

      const itemTotalPrice = (item.price || 0) * (item.quantity || 1);

      itemsListHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 16px 0; text-align: left; vertical-align: top;">
            <div style="font-weight: 600; color: #0a1c3e; font-size: 15px;">${title}</div>
            <div style="font-size: 12px; color: #718096; margin-top: 4px; font-weight: 500;">${variant}</div>
          </td>
          <td style="padding: 16px 0; text-align: center; vertical-align: top; color: #4a5568; font-weight: 500; font-size: 14px;">
            ${item.quantity}
          </td>
          <td style="padding: 16px 0; text-align: right; vertical-align: top; font-weight: 600; color: #0a1c3e; font-size: 15px;">
            ${formatEmailPrice(itemTotalPrice, order.currency, order.exchangeRate)}
          </td>
        </tr>
      `;
    }

    let discountRowHtml = "";
    if (order.discountAmount && order.discountAmount > 0) {
      discountRowHtml = `
        <tr style="color: #e53e3e;">
          <td colspan="2" style="padding: 8px 0; font-weight: 500; text-align: left; font-size: 14px;">
            Discount (${order.couponCode || "Coupon"})
          </td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px;">
            -${formatEmailPrice(order.discountAmount, order.currency, order.exchangeRate)}
          </td>
        </tr>
      `;
    }

    let taxRowHtml = "";
    const taxAmount = Math.max(0, order.totalAmount - (order.subTotal - (order.discountAmount || 0)));
    if (taxAmount > 0) {
      taxRowHtml = `
        <tr>
          <td colspan="2" style="padding: 8px 0; text-align: left; font-weight: 500; font-size: 14px;">
            Tax
          </td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px;">
            ${formatEmailPrice(taxAmount, order.currency, order.exchangeRate)}
          </td>
        </tr>
      `;
    }

    const orderDateFormatted = new Date(order.createdAt).toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const emailHtml = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #f7fafc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #2d3748;
          -webkit-font-smoothing: antialiased;
        }
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #f7fafc;
          padding: 40px 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(10, 28, 62, 0.05);
          border: 1px solid #edf2f7;
        }
        .header {
          background-color: #0a1c3e;
          padding: 32px;
          text-align: left;
        }
        .header h1 {
          margin: 0;
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          line-height: 1.2;
        }
        .header p {
          margin: 4px 0 0 0;
          color: #a0aec0;
          font-size: 13px;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .body-content {
          padding: 40px 32px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 700;
          color: #0a1c3e;
          margin-bottom: 16px;
        }
        .intro-text {
          font-size: 15px;
          line-height: 1.6;
          color: #4a5568;
          margin-bottom: 32px;
        }
        .meta-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
        }
        .meta-title {
          font-size: 13px;
          font-weight: 700;
          color: #0a1c3e;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
        }
        .meta-row {
          display: table;
          width: 100%;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .meta-row:last-child {
          margin-bottom: 0;
        }
        .meta-label {
          display: table-cell;
          color: #718096;
          font-weight: 500;
          width: 120px;
        }
        .meta-value {
          display: table-cell;
          color: #2d3748;
          font-weight: 600;
        }
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 32px;
        }
        .invoice-table th {
          padding-bottom: 12px;
          border-bottom: 2px solid #e2e8f0;
          color: #718096;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .summary-block {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 32px;
        }
        .summary-block td {
          font-size: 14px;
          color: #4a5568;
        }
        .summary-total {
          background-color: #f0f4f8;
          border-radius: 8px;
        }
        .summary-total td {
          font-size: 18px !important;
          font-weight: 700 !important;
          color: #0a1c3e !important;
          padding: 16px 20px !important;
        }
        .address-section {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          margin-top: 32px;
        }
        .footer {
          background-color: #0a1c3e;
          padding: 32px;
          text-align: center;
          color: #a0aec0;
          font-size: 12px;
          line-height: 1.5;
        }
        .footer a {
          color: #ffffff;
          text-decoration: none;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
              <tr>
                <td style="vertical-align: middle; text-align: left;">
                  <img src="${process.env.CLIENT_URL || 'http://localhost:3000'}/favicon/apple-touch-icon.png" alt="Praya Diamond Logo" height="50" style="display: block; border: 0;" />
                </td>
                <td style="vertical-align: middle; text-align: right;">
                  <h1>PRAYA DIAMONDS</h1>
                  <p>Order Confirmation</p>
                </td>
              </tr>
            </table>
          </div>
          <div class="body-content">
            <div class="greeting">Dear ${customerName},</div>
            <div class="intro-text">
              Thank you for shopping with us! Your order has been confirmed and is now being prepared for shipping.
            </div>

            <div class="meta-card">
              <div class="meta-title">Order Summary</div>
              <div class="meta-row">
                <span class="meta-label">Order ID:</span>
                <span class="meta-value" style="font-family: monospace;">#${order.orderId}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Order Date:</span>
                <span class="meta-value">${orderDateFormatted}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Status:</span>
                <span class="meta-value" style="color: #2b6cb0;">Confirmed</span>
              </div>
            </div>

            <table class="invoice-table">
              <thead>
                <tr>
                  <th style="text-align: left; width: 60%;">Item Description</th>
                  <th style="text-align: center; width: 15%;">Qty</th>
                  <th style="text-align: right; width: 25%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsListHtml}
              </tbody>
            </table>

            <table class="summary-block">
              <tbody>
                <tr>
                  <td colspan="2" style="padding: 8px 0; text-align: left; font-weight: 500;">Subtotal</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">
                    ${formatEmailPrice(order.subTotal, order.currency, order.exchangeRate)}
                  </td>
                </tr>
                ${discountRowHtml}
                ${taxRowHtml}
                <tr class="summary-total">
                  <td colspan="2" style="text-align: left;">Total</td>
                  <td style="text-align: right;">
                    ${formatEmailPrice(order.totalAmount, order.currency, order.exchangeRate)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="address-section">
              <div class="meta-title" style="margin-bottom: 12px; border: none; padding: 0;">Shipping Information</div>
              <div style="font-size: 14px; line-height: 1.6; color: #4a5568;">
                <strong style="color: #0a1c3e;">${customerName}</strong><br>
                ${order.shippingAddress.street || ""}<br>
                ${order.shippingAddress.city || ""}, ${order.shippingAddress.state || ""} ${order.shippingAddress.zip || ""}<br>
                ${order.shippingAddress.country || ""}${customerPhone ? `<br>${customerPhone}` : ""}
              </div>
            </div>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact our support team at <a href="mailto:${process.env.SMTP_USER}">${process.env.SMTP_USER}</a>.</p>
            <p style="margin-top: 16px;">&copy; ${new Date().getFullYear()} Praya Diamond. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>`;

    await sendMail(customerEmail, `Order Confirmation - ${order.orderId}`, emailHtml);
    console.log(`Confirmation email sent successfully for order ${order.orderId} to ${customerEmail}`);
  } catch (error) {
    console.error("Error sending order confirmation email helper:", error);
  }
};

module.exports = sendOrderConfirmationEmail;
