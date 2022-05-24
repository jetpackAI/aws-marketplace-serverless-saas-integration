const AWS = require("aws-sdk");
const ses = new AWS.SES({ region: "us-east-1" });
const marketplacemetering = new AWS.MarketplaceMetering({
  apiVersion: "2016-01-14",
  region: "us-east-1",
});
const dynamodb = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});
const sqs = new AWS.SQS({ apiVersion: "2012-11-05", region: "us-east-1" });
const {
  NewSubscribersTableName: newSubscribersTableName,
  EntitlementQueueUrl: entitlementQueueUrl,
  MarketplaceSellerEmail: marketplaceSellerEmail,
} = process.env;

const lambdaResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
  },

  body: JSON.stringify(body),
});

const setBuyerNotificationHandler = function (contactEmail) {
  if (typeof marketplaceSellerEmail == "undefined") {
    return;
  }

  const newSubscriberEmail = `
<!DOCTYPE html>
<html>
  <head>
    <title>Welcome to Flow!</title>
  </head>
  <body>
    <p>Congratulations!</p>
    <p>
      You are receiving this email because you recently subscribed to Flow on
      the AWS Marketplace and completed the contact form.
    </p>
    <p>
      Our team is already at work to create your environment. In order
      to finalize its creation, we will need to get in contact with you so
      please expect to hear from a member of our team in a few business days.
    </p>
    <br />
    <p>Thank you !</p>
    <p>The Jetpack.AI Team</p>
  </body>
</html>
`;

  const newSubscriberText = `
Congratulations! 
You are receiving this message because you recently subscribed to Flow on the AWS Marketplace and completed the contact form. Our team is already at work to create your environment. 
In order to finalize its creation, we will need to get in contact with you so please expect to hear from a member of our team in a few business days. 

Thank you ! 
The Jetpack.AI Team`;

  let params = {
    Destination: {
      ToAddresses: [contactEmail],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: newSubscriberEmail,
        },
        Text: {
          Charset: "UTF-8",
          Data: newSubscriberText,
        },
      },

      Subject: {
        Charset: "UTF-8",
        Data: "Your Flow subscription",
      },
    },
    Source: marketplaceSellerEmail,
  };

  return ses.sendEmail(params).promise();
};

exports.registerNewSubscriber = async (event) => {
  const { regToken, companyName, contactPerson, contactPhone, contactEmail } =
    JSON.parse(event.body);

  // Validate the request
  if (
    regToken &&
    companyName &&
    contactPerson &&
    contactPhone &&
    contactEmail
  ) {
    try {
      // Call resolveCustomer to validate the subscriber
      const resolveCustomerParams = {
        RegistrationToken: regToken,
      };

      const resolveCustomerResponse = await marketplacemetering
        .resolveCustomer(resolveCustomerParams)
        .promise();

      // Store new subscriber data in dynamoDb
      const { CustomerIdentifier, ProductCode } = resolveCustomerResponse;

      const datetime = new Date().getTime().toString();

      const dynamoDbParams = {
        TableName: newSubscribersTableName,
        Item: {
          companyName: { S: companyName },
          contactPerson: { S: contactPerson },
          contactPhone: { S: contactPhone },
          contactEmail: { S: contactEmail },
          customerIdentifier: { S: CustomerIdentifier },
          productCode: { S: ProductCode },
          created: { S: datetime },
        },
      };

      await dynamodb.putItem(dynamoDbParams).promise();

      // Only for SaaS Contracts, check entitlement
      if (entitlementQueueUrl) {
        const SQSParams = {
          MessageBody: `{ 
              "Type": "Notification", 
              "Message" : {
                  "action" : "entitlement-updated",
                  "customer-identifier": "${CustomerIdentifier}",
                  "product-code" : "${ProductCode}"
                  } 
              }`,
          QueueUrl: entitlementQueueUrl,
        };
        await sqs.sendMessage(SQSParams).promise();
      }

      await setBuyerNotificationHandler(contactEmail);

      return lambdaResponse(
        200,
        "Success! Registration completed. A member of our team will be contacting you in a few business days in order to finalize the creation of your environment. Please contact us through our website if you have any questions."
      );
    } catch (error) {
      console.error(error);
      return lambdaResponse(
        400,
        "Registration data not valid. Please try again, or contact support!"
      );
    }
  } else {
    return lambdaResponse(400, "Request no valid");
  }
};
