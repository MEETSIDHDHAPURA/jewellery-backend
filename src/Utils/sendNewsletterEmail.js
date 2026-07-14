const Product = require("../Models/Product.Model");
const Newsletter = require("../Models/Newsletter.Model");
const sendMail = require("./Nodemailer");

// Helper to resolve Product absolute image URL
const getProductImage = (product) => {
  if (!product || !product.metalImages) return "https://placehold.co/600x400?text=New+Arrival";
  
  let rawImg = "";
  const keys = ["yellowGold", "whiteGold", "roseGold", "silver", "platinum"];
  for (const key of keys) {
    const imagesForMetal = product.metalImages[key] || [];
    if (imagesForMetal.length > 0) {
      rawImg = imagesForMetal[0];
      break;
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

  return "https://placehold.co/600x400?text=New+Arrival";
};

const sendNewProductNewsletterEmail = async (productId) => {
  try {
    const product = await Product.findById(productId).lean();
    if (!product || !product.isActive || product.isDeleted) {
      console.log(`Product ${productId} is not eligible for newsletter (does not exist, inactive, or deleted).`);
      return;
    }

    const subscribers = await Newsletter.find({ isActive: true }).select("email").lean();
    if (subscribers.length === 0) {
      console.log("No active newsletter subscribers found.");
      return;
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const storeName = process.env.STORE_NAME || "Praya Diamonds";
    const imageUrl = getProductImage(product);
    const productUrl = `${clientUrl}/products/${product.slug || product._id}`;
    
    // Strip HTML tags for email text preview
    const cleanDescription = product.description 
      ? product.description.replace(/<[^>]*>/g, "").substring(0, 160) + "..."
      : "Discover our newest luxury addition.";

    const price = product.Price || 0;
    const formattedPrice = `$${price.toLocaleString()}`;

    const subject = `Just Added: The New ${product.title}`;

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

                <!-- Hero Section Banner (Product Image) -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${productUrl}" target="_blank" style="text-decoration: none; display: block;">
                      <img src="${imageUrl}" alt="${product.title}" style="width: 100%; max-width: 600px; height: 350px; object-fit: cover; display: block; border-bottom: 1px solid #edf2f7;" />
                    </a>
                  </td>
                </tr>

                <!-- Body Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 10px 0; font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #b8860b; letter-spacing: 0.1em; text-transform: uppercase;">
                      New Arrival
                    </p>
                    <h2 style="margin: 0 0 12px 0; font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 700; color: #0a1c3e; line-height: 1.3;">
                      ${product.title}
                    </h2>
                    <p style="margin: 0 0 20px 0; font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; color: #0a1c3e;">
                      ${formattedPrice}
                    </p>
                    <p style="margin: 0 0 30px 0; font-family: Helvetica, Arial, sans-serif; font-size: 15px; color: #4a5568; line-height: 1.6;">
                      ${cleanDescription}
                    </p>
                    
                    <!-- Call to Action -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="${productUrl}" target="_blank" style="background-color: #b8860b; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 30px; font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; display: inline-block; box-shadow: 0 4px 6px rgba(184, 134, 11, 0.25);">
                            Explore New Arrival
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
                      You are receiving this email because you signed up for our newsletter mailing list.
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

    console.log(`Sending new product promotional emails to ${subscribers.length} subscribers...`);
    
    // Loop sendMail for all active subscribers (runs asynchronously in the background)
    for (const sub of subscribers) {
      await sendMail(sub.email, subject, emailHtml).catch(err => {
        console.error(`Failed to send newsletter email to subscriber: ${sub.email}`, err);
      });
    }

    console.log("Finished sending promotional new product emails.");
  } catch (error) {
    console.error("Error dispatching product promotional emails:", error);
  }
};

module.exports = { sendNewProductNewsletterEmail };
