import * as cognito from "aws-cdk-lib/aws-cognito";

export interface IUserPoolAndClient {
  client: cognito.UserPoolClient;
  userPool: cognito.UserPool;
}
