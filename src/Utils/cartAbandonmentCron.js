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
    .populate("items.product");

    console.log(`Found ${carts.length} abandoned carts to process.`);

    for (const cart of carts) {
      if (!cart.user || !cart.user.email) {
        // Skip if no user or user has no email
        continue;
      }

      const userEmail = cart.user.email;
      const userName = cart.user.name || "Valued Customer";
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      const storeName = process.env.STORE_NAME || "Praya Diamonds";

      // Build cart items HTML
      let itemsHtml = "";
      for (const item of cart.items) {
        if (!item.product) continue;
        
        const title = item.product.title || "Fine Jewel";
        const price = item.price || item.product.Price || 0;
        const formattedPrice = `$${price.toLocaleString()}`;
        const imageUrl = getProductImage(item.product, item.metal);
        
        // Build product page link with selected variants as query parameters
        const queryParams = [];
        if (item.metal) queryParams.push(`metal=${encodeURIComponent(item.metal)}`);
        if (item.carat) queryParams.push(`carat=${encodeURIComponent(item.carat)}`);
        if (item.clarity) queryParams.push(`clarity=${encodeURIComponent(item.clarity)}`);
        if (item.color) queryParams.push(`color=${encodeURIComponent(item.color)}`);
        if (item.size) queryParams.push(`size=${encodeURIComponent(item.size)}`);
        if (item.diamondType) {
          const displayType = item.diamondType.includes("Lab") ? "Lab" : "Natural";
          queryParams.push(`type=${encodeURIComponent(displayType)}`);
        }
        const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
        const productUrl = `${clientUrl}/products/${item.product.slug || item.product._id}${queryString}`;

        const specs = [];
        if (item.metal) specs.push(item.metal);
        if (item.carat) specs.push(item.carat);
        if (item.size) specs.push(`Size ${item.size}`);
        const specsText = specs.join(" · ");

        itemsHtml += `
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 16px 0; vertical-align: top; width: 80px;">
              <a href="${productUrl}" target="_blank" style="text-decoration: none;">
                <img src="${imageUrl}" alt="${title}" width="80" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #edf2f7; display: block;" />
              </a>
            </td>
            <td style="padding: 16px 0 16px 16px; vertical-align: top; text-align: left;">
              <h4 style="margin: 0 0 6px 0; font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: #0a1c3e;">
                <a href="${productUrl}" target="_blank" style="color: #0a1c3e; text-decoration: none;">${title}</a>
              </h4>
              <p style="margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #718096; line-height: 1.4;">
                ${specsText}
              </p>
              <div style="margin-top: 8px;">
                <a href="${productUrl}" target="_blank" style="font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #b8860b; text-decoration: none; font-weight: 600; display: inline-block;">
                  View Product &rarr;
                </a>
              </div>
            </td>
            <td style="padding: 16px 0; vertical-align: top; text-align: right; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0a1c3e; width: 100px;">
              ${formattedPrice}
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
      const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f7fafc; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7fafc; padding: 40px 0;">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e2e8f0;">
                  
                  <!-- Header -->
                  <tr>
                    <td align="center" style="background-color: #0a1c3e; padding: 32px 20px; border-bottom: 3px solid #b8860b;">
                      <h1 style="margin: 0; font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: 0.15em; text-transform: uppercase;">
                        ${storeName}
                      </h1>
                    </td>
                  </tr>

                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="margin: 0 0 16px 0; font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 700; color: #0a1c3e; line-height: 1.3;">
                        Hello, ${userName}
                      </h2>
                      <p style="margin: 0 0 24px 0; font-family: Helvetica, Arial, sans-serif; font-size: 15px; color: #4a5568; line-height: 1.6;">
                        We noticed you left some exquisite handcrafted pieces in your shopping cart. These items are highly sought after and we want to ensure you don't miss out on securing them.
                      </p>
                      
                      <!-- Cart Table -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 30px;">
                        ${itemsHtml}
                      </table>

                      <!-- Call to Action -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center">
                            <a href="${clientUrl}/cart" target="_blank" style="background-color: #b8860b; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 30px; font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; display: inline-block; box-shadow: 0 4px 6px rgba(184, 134, 11, 0.25);">
                              Return to Shopping Cart
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="background-color: #f7fafc; padding: 30px 20px; border-top: 1px solid #edf2f7;">
                      <p style="margin: 0 0 8px 0; font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #a0aec0;">
                        Questions? Reply to this email or contact our client services team.
                      </p>
                      <p style="margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #a0aec0;">
                        &copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

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
