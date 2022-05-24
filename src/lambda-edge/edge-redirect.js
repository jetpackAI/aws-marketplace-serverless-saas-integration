const AWS = require("aws-sdk");
const marketplacemetering = new AWS.MarketplaceMetering({
  apiVersion: "2016-01-14",
  region: "us-east-1",
});
const dynamodb = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});

const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

exports.lambdaHandler = async (event) => {
  console.log(JSON.stringify(event.Records[0].cf));

  const { request } = event.Records[0].cf;

  const redirect = request.method === "POST" && request.body.data;
  let redirect_url;

  if (redirect) {
    const body = Buffer.from(request.body.data, "base64").toString();
    console.log(body);

    try {
      const regToken = body.split("=")[1];
      console.log(regToken);

      const decodedRegToken = decodeURIComponent(regToken);
      console.log(decodedRegToken);

      // Call resolveCustomer to validate the subscriber
      const resolveCustomerParams = {
        RegistrationToken: decodedRegToken,
      };

      const resolveCustomerResponse = await marketplacemetering
        .resolveCustomer(resolveCustomerParams)
        .promise();

      // Store new subscriber data in dynamoDb
      const { CustomerIdentifier, ProductCode } = resolveCustomerResponse;

      const item = unmarshall(
        (
          await dynamodb
            .getItem({
              Key: {
                customerIdentifier: {
                  S: CustomerIdentifier,
                },
              },
              TableName: "AWSMarketplaceSubscribers",
            })
            .promise()
        ).Item
      );

      redirect_url = item.redirectPage;
      console.log(redirect_url);
    } catch (error) {
      console.error(error);
    }

    const url_parameters = redirect_url
      ? `${body}&redirect-url=${redirect_url}`
      : `${body}`;

    return {
      status: "302",
      statusDescription: "Found",
      headers: {
        location: [
          {
            key: "Location",
            value: `/?${url_parameters}`,
          },
        ],
      },
    };
  }

  return request;
};
