import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { IUserPoolAndClient } from "../src/interfaces/IUserPoolClient";
import { Plus1CloudStack } from "./plus1-cloud-stack";

export class CongnitoUtil {
  static createUserPool(stack: Plus1CloudStack): IUserPoolAndClient {
    const stackName = stack.stackProps.stackName;
    let removalPolicy = cdk.RemovalPolicy.RETAIN;
    if (stack.stackConfig.cognitoRemoval) {
      removalPolicy = cdk.RemovalPolicy.DESTROY;
    }
    const userPool = new cognito.UserPool(stack, `${stackName}UserPoolId`, {
      userPoolName: `${stackName}UserPool`,
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
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy,
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

    const client = userPool.addClient(`${stackName}CognitoClient`, {
      userPoolClientName: `${stackName}CognitoApp`,
      generateSecret: false,
      idTokenValidity: cdk.Duration.minutes(30),
      preventUserExistenceErrors: true,
      authFlows: {
        custom: true,
        userPassword: true,
        userSrp: true,
      },
    });
    return { client, userPool };
  }
}
