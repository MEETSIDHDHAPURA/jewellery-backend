const cron = require("node-cron");
const Cart = require("../Models/Cart.Model");
const sendMail = require("./Nodemailer");

// Resolve Product/Variant Image absolute URL
const getProductImage = (product, metal) => {
  if (!product) return "https://placehold.co/400x400?text=Jewellery";
  
  let rawImg = "";
  if (product.metalImages) {
    let key = "yellowGold";
    if (metal) {
      const lower = metal.toLowerCase();
      if (lower.includes("white")) key = "whiteGold";
      else if (lower.includes("rose")) key = "roseGold";
      else if (lower.includes("silver")) key = "silver";
      else if (lower.includes("platinum")) key = "platinum";
    }
    const imagesForMetal = product.metalImages[key] || [];
    if (imagesForMetal.length > 0) {
      rawImg = imagesForMetal[0];
    } else {
      const allImages = [
        ...(product.metalImages.yellowGold || []),
        ...(product.metalImages.whiteGold || []),
        ...(product.metalImages.roseGold || []),
        ...(product.metalImages.silver || []),
        ...(product.metalImages.platinum || [])
      ];
      if (allImages.length > 0) rawImg = allImages[0];
    }
  }

  if (!rawImg) {
    if (product.images && product.images.length > 0) {
      const imgObj = product.images[0];
      rawImg = typeof imgObj === "string" ? imgObj : (imgObj.src || "");
    } else if (product.productImages && product.productImages.length > 0) {
      rawImg = product.productImages[0];
    }
  }

  if (rawImg) {
    if (rawImg.startsWith("http://") || rawImg.startsWith("https://")) {
      return rawImg;
    }
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const cleanPath = rawImg.startsWith("/") ? rawImg : `/${rawImg}`;
    return `${backendUrl}${cleanPath}`;
  }

  return "https://placehold.co/400x400?text=Jewellery";
};

// Check for abandoned carts (last updated >= 3 days ago)
const checkAbandonedCarts = async () => {
  try {
    console.log("Running Cart Abandonment Cron job check...");
    
    // 3 days ago cutoff
    const cutoffDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    const carts = await Cart.find({
      items: { $exists: true, $not: { $size: 0 } },
      updatedAt: { $lt: cutoffDate },
      abandonedEmailSent: { $ne: true }
    })
    .populate("user")
    .populate("items.product")
    .populate("items.diamond");

    console.log(`Found ${carts.length} abandoned carts to process.`);

    for (const cart of carts) {
      if (!cart.user || !cart.user.email) {
        // Skip if no user or user has no email
        continue;
      }

      const userEmail = cart.user.email;
      const userName = cart.user.name;
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      const storeName = process.env.STORE_NAME || "Praya Diamonds";

      // Build cart items HTML
      let itemsHtml = "";
      let subTotal = 0;
      for (const item of cart.items) {
        if (!item.product && !item.diamond) continue;
        
        let title = "Untitled Product";
        let variant = "";
        if (item.product) {
          title = item.product.title || "Untitled Product";
        } else if (item.diamond) {
          title = `Loose Diamond - ${item.diamond.shape || ''} ${item.diamond.diamondType || ''}`;
        }

        const specs = [];
        if (item.metal) specs.push(item.metal);
        if (item.carat) specs.push(item.carat);
        if (item.clarity) specs.push(item.clarity);
        if (item.color) specs.push(item.color);
        if (item.size) specs.push(`Size ${item.size}`);
        variant = specs.join(" · ") || "Standard";

        // Resolve Product/Variant Image
        let rawImg = "";
        if (item.product) {
          const metal = item.metal || "";
          if (item.product.metalImages) {
            let key = "yellowGold";
            if (metal) {
              const lower = metal.toLowerCase();
              if (lower.includes("white")) key = "whiteGold";
              else if (lower.includes("rose")) key = "roseGold";
              else if (lower.includes("silver")) key = "silver";
              else if (lower.includes("platinum")) key = "platinum";
            }
            const imagesForMetal = item.product.metalImages[key] || [];
            if (imagesForMetal.length > 0) {
              rawImg = imagesForMetal[0];
            } else {
              const allImages = [
                ...(item.product.metalImages.yellowGold || []),
                ...(item.product.metalImages.whiteGold || []),
                ...(item.product.metalImages.roseGold || []),
                ...(item.product.metalImages.silver || []),
                ...(item.product.metalImages.platinum || [])
              ];
              if (allImages.length > 0) rawImg = allImages[0];
            }
          }
          if (!rawImg) {
            if (item.product.images && item.product.images.length > 0) {
              const imgObj = item.product.images[0];
              rawImg = typeof imgObj === "string" ? imgObj : (imgObj.src || "");
            } else if (item.product.productImages && item.product.productImages.length > 0) {
              rawImg = item.product.productImages[0];
            }
          }
        } else if (item.diamond) {
          if (item.diamond.image && item.diamond.image.length > 0) {
            rawImg = item.diamond.image[0];
          }
        }

        // Resolve image absolute URL
        let imgSrc = "";
        if (rawImg) {
          if (rawImg.startsWith("http://") || rawImg.startsWith("https://")) {
            imgSrc = rawImg;
          } else {
            const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
            const cleanPath = rawImg.startsWith("/") ? rawImg : `/${rawImg}`;
            imgSrc = `${backendUrl}${cleanPath}`;
          }
        } else {
          imgSrc = "https://placehold.co/400x400?text=Jewellery";
        }

        let imageColHtml = "";
        if (imgSrc) {
          imageColHtml = `
            <td style="vertical-align: top; width: 60px; padding-right: 12px;">
              <img src="${imgSrc}" alt="${title}" width="60" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; display: block; border: 1px solid #edf2f7;" />
            </td>
          `;
        }

        // Resolve link
        let productUrl = "";
        if (item.product) {
          const productSlugOrId = item.product.slug || item.product._id;
          const queryParams = [];
          if (item.metal) queryParams.push(`metal=${encodeURIComponent(item.metal)}`);
          if (item.carat) queryParams.push(`carat=${encodeURIComponent(item.carat)}`);
          if (item.clarity) queryParams.push(`clarity=${encodeURIComponent(item.clarity)}`);
          if (item.color) queryParams.push(`color=${encodeURIComponent(item.color)}`);
          if (item.size) queryParams.push(`size=${encodeURIComponent(item.size)}`);
          if (item.diamondType) {
            const displayType = item.diamondType.includes('Lab') ? 'Lab' : 'Natural';
            queryParams.push(`type=${encodeURIComponent(displayType)}`);
          }
          const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
          productUrl = `${clientUrl}/products/${productSlugOrId}${queryString}`;
        } else if (item.diamond) {
          productUrl = `${clientUrl}/diamonds/${item.diamond.slug || item.diamond._id}`;
        }

        const titleLinkHtml = productUrl 
          ? `<a href="${productUrl}" target="_blank" style="color: #0a1c3e; text-decoration: none; font-weight: 600;">${title}</a>`
          : title;

        const price = item.price || (item.product && item.product.Price) || (item.diamond && item.diamond.price) || 0;
        const qty = item.quantity || 1;
        const itemTotalPrice = price * qty;
        subTotal += itemTotalPrice;

        itemsHtml += `
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 16px 0; text-align: left; vertical-align: top;">
              <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  ${imageColHtml}
                  <td style="vertical-align: top; text-align: left;">
                    <div style="font-weight: 600; color: #0a1c3e; font-size: 15px;">${titleLinkHtml}</div>
                    <div style="font-size: 12px; color: #718096; margin-top: 4px; font-weight: 500;">${variant}</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="padding: 16px 0; text-align: center; vertical-align: top; color: #4a5568; font-weight: 500; font-size: 14px;">
              ${qty}
            </td>
            <td style="padding: 16px 0; text-align: right; vertical-align: top; font-weight: 600; color: #0a1c3e; font-size: 15px; width: 100px;">
              $${itemTotalPrice.toLocaleString()}
            </td>
          </tr>
        `;
      }

      if (!itemsHtml) {
        // If no valid products in cart, skip
        continue;
      }

      // Premium HTML Email Template
      const subject = `Still thinking about it? Your cart is waiting...`;
      const discountAmount = cart.discountAmount || 0;
      const totalAmount = Math.max(0, subTotal - discountAmount);

      const emailHtml = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
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
                    <img src="${clientUrl}/favicon/apple-touch-icon.png" alt="Praya Diamond Logo" height="50" style="display: block; border: 0;" />
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <h1>${storeName.toUpperCase()}</h1>
                    <p>Shopping Cart</p>
                  </td>
                </tr>
              </table>
            </div>
            <div class="body-content">
              <div class="greeting">Hello, ${userName}</div>
              <div class="intro-text">
                We noticed you left some exquisite handcrafted pieces in your shopping cart. These items are highly sought after and we want to ensure you don't miss out on securing them.
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
                  ${itemsHtml}
                </tbody>
              </table>

              <table class="summary-block">
                <tbody>
                  <tr>
                    <td colspan="2" style="padding: 8px 0; text-align: left; font-weight: 500;">Subtotal</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">
                      $${subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  ${discountAmount > 0 ? `
                  <tr style="color: #e53e3e;">
                    <td colspan="2" style="padding: 8px 0; font-weight: 500; text-align: left; font-size: 14px;">
                      Discount (${cart.couponCode || "Coupon"})
                    </td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px;">
                      -$${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  ` : ""}
                  <tr class="summary-total">
                    <td colspan="2" style="text-align: left;">Total Value</td>
                    <td style="text-align: right;">
                      $${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Call to Action -->
              <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-top: 32px;">
                <tr>
                  <td align="center">
                    <a href="${clientUrl}/cart" target="_blank" style="background-color: #b8860b; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; display: inline-block; box-shadow: 0 4px 6px rgba(184, 134, 11, 0.25);">
                      Return to Shopping Cart
                    </a>
                  </td>
                </tr>
              </table>
            </div>
            <div class="footer">
              <p>Questions? Reply to this email or contact our client services team at <a href="mailto:${process.env.SMTP_USER}">${process.env.SMTP_USER}</a>.</p>
              <p style="margin-top: 16px;">&copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>`;

      await sendMail(userEmail, subject, emailHtml);
      
      // Update flag to prevent duplicate emails
      cart.abandonedEmailSent = true;
      await cart.save();
      console.log(`Successfully sent cart abandonment promo email to user: ${userEmail}`);
    }
  } catch (error) {
    console.error("Error checking/processing abandoned carts:", error);
  }
};

const startCartAbandonmentCron = () => {
  // Run every hour
  cron.schedule("0 * * * *", checkAbandonedCarts);
  console.log("Cart Abandonment Cron job initialized.");
};

module.exports = {
  startCartAbandonmentCron,
  checkAbandonedCarts
};
