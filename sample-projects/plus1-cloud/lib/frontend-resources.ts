import * as fs from "fs";
import * as path from "path";

import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3Deployment from "aws-cdk-lib/aws-s3-deployment";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as dotenv from "dotenv";
import { Plus1CloudStack } from "./plus1-cloud-stack";
import { IStackEnv } from "../src/interfaces/IStackEnv";

export type DistAndBucket = {
  distribution: cloudfront.Distribution;
  bucket: s3.Bucket;
};

export class FrontendResources {
  stack: Plus1CloudStack;

  config: IStackEnv;

  stackName: string;

  constructor(stack: Plus1CloudStack) {
    dotenv.config();

    this.stack = stack;
    this.config = stack.stackConfig;
    this.stackName = stack.stackProps.stackName || "";
  }

  provisionResources(): DistAndBucket {
    const bucket = this.provisionBucket();
    const cert = this.getCertificate();
    const distribution = this.provisionDistribution(bucket, cert);
    this.deployAssets(bucket);
    return { distribution, bucket };
  }

  private provisionBucket(): s3.Bucket {
    const bucketName = this.config.originBucketName;
    return new s3.Bucket(this.stack, `${this.stackName}S3Bucket`, {
      bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }

  private getCertificate(): acm.ICertificate {
    /*  Distribution certificates must be in the us-east-1 region */
    const certificateArn = this.config.certificateArn;
    return acm.Certificate.fromCertificateArn(
      this.stack,
      `${this.stackName}Certificate`,
      certificateArn
    );
  }

  private provisionDistribution(
    bucket: s3.Bucket,
    certificate: acm.ICertificate
  ): cloudfront.Distribution {
    const domainNames = this.config.domainNames;
    return new cloudfront.Distribution(
      this.stack,
      `${this.stackName}Distribution`,
      {
        defaultBehavior: {
          origin: new origins.S3Origin(bucket),
        },
        comment: `CF dist for ${this.stackName} frontend`,
        defaultRootObject: "index.html",
        domainNames,
        certificate,
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
      }
    );
  }

  private deployAssets(destinationBucket: s3.Bucket) {
    if (process.env.NODE_ENV != "local") {
      return;
    }
    const assetPath = this.config.assetPath; //path.join(__dirname, "..", this.config.assetPath);
    console.log('assetPath', assetPath);

    if (!fs.existsSync(assetPath)) {
      throw new Error(`Directory does not exits: ${assetPath}`);
    }
    new s3Deployment.BucketDeployment(
      this.stack,
      `${this.stackName}DeployAsset`,
      {
        sources: [s3Deployment.Source.asset(assetPath)],
        destinationBucket,
      }
    );
  }
}
