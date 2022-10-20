import * as cdk from "aws-cdk-lib";
import { Construct } from 'constructs';
import * as cognito from "aws-cdk-lib/aws-cognito";

export class UserManagementStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const userPool = this.createUserPool();
    const client = this.createClient(userPool);
    this.setupOutput(userPool, client);
  }

  createUserPool(): cognito.UserPool {
    return new cognito.UserPool(this, 'PoolId', {
      userPoolName: 'AppUserPool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      keepOriginal: {
        email: true,
      },
      standardAttributes: {},
      customAttributes: {
        uniqueId: new cognito.StringAttribute({
          minLen: 22,
          maxLen: 23,
          mutable: false,
        }),
        userId: new cognito.NumberAttribute({
          min: 1,
          max: 999999,
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 20,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,  //should be RETAIN in production 
      userVerification: {
        emailSubject: "Verify your email for our awesome app!",
        emailBody:
          "Thanks for signing up to our awesome app! Your verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
        smsMessage:
          "Thanks for signing up to our awesome app! Your verification code is {####}",
      },
      userInvitation: {
        emailSubject: "Invite to join our awesome app!",
        emailBody:
          "Hello {username}, you have been invited to join our awesome app! Your temporary password is {####}",
        smsMessage:
          "Hello {username}, your temporary password for our awesome app is {####}",
      },
      signInCaseSensitive: false,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
    });
  }

  createClient(userPool: cognito.UserPool): cognito.UserPoolClient {
    return userPool.addClient("ClientId", {
      userPoolClientName: "Plus1 App",
      generateSecret: false,
    });
  }

  setupOutput(userPool: cognito.UserPool, client: cognito.UserPoolClient) {
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: client.userPoolClientId,
    });
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });
  }
}
