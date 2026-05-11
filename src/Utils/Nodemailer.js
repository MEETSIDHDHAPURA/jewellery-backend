const fetch = require("node-fetch");
const ApiError = require("./ApiError");

const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const senderEmail = process.env.SMTP_USER;

async function getToken() {
  try {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('grant_type', 'client_credentials');

    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    const data = await res.json();
    if (!res.ok || data.error) {
       console.error("Token Error Response:", data);
       throw new Error(`Failed to retrieve token: ${data.error_description || data.error}`);
    }
    return data.access_token;
  } catch (error) {
    console.error("Get Token Error:", error);
    throw error;
  }
}

const sendMail = async (to, subject, htmlContent, attachments = [], cc = null) => {
  try {
    const token = await getToken();

    // Handle 'to' recipients
    let recipientsList = [];
    if (Array.isArray(to)) {
        recipientsList = to;
    } else if (typeof to === 'string') {
        recipientsList = to.split(',').map(e => e.trim());
    }

    const toRecipients = recipientsList.map(email => ({
        emailAddress: { address: email }
    }));

    const message = {
      subject: subject,
      body: {
        contentType: "HTML",
        content: htmlContent
      },
      toRecipients: toRecipients
    };

    // Handle CC
    if (cc) {
        let ccList = [];
        if (Array.isArray(cc)) {
            ccList = cc;
        } else if (typeof cc === 'string') {
            ccList = cc.split(',').map(e => e.trim());
        }
        message.ccRecipients = ccList.map(email => ({
            emailAddress: { address: email }
        }));
    }

    // Note: Attachments handling is skipped as it requires specific Base64 formatting 
    // and is not currently used in the main logic paths verified.

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        saveToSentItems: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Graph API SendMail Error:", errorText);
      throw new Error(`Graph API returned ${response.status}: ${response.statusText}`);
    }

    console.log("Email sent successfully via Graph API");
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    throw new ApiError(400, "Failed to send email");
  }
};

module.exports = sendMail;


