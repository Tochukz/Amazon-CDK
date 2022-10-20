import * as fs from 'fs';
import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { IConfig } from './../src/iconfig';


export class FrontendStack extends cdk.Stack {
  
  config: IConfig;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.config = this.getConfig();

    const bucket = this.provisionBucket();
    const cert = this.getCertificate();
    const distribution = this.provisionDistribution(bucket, cert);
    this.deployAssets(bucket);
    this.setupOutput(distribution);
  }

  provisionBucket(): s3.Bucket {
    return new s3.Bucket(this, 'S3Bucket', {
      bucketName: 'ecommerce-frontend-origin',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }

  getCertificate(): acm.ICertificate {
    /*  Distribution certificates must be in the us-east-1 region */
    const certificateArn = this.config.certificateArn;
    return acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn);
  }

  provisionDistribution(bucket: s3.Bucket, certificate: acm.ICertificate): cloudfront.Distribution {
    const domainNames = this.config.domainNames;
    return new cloudfront.Distribution(this, "CfDistribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket),       
      },
      comment: 'A distribution for any frontend framework',
      defaultRootObject: 'index.html',
      domainNames,
      certificate,
      errorResponses: [
        {
          httpStatus: 403, 
          responseHttpStatus: 200,
          responsePagePath: '/index.html'
        }
      ]
    });
  }

  deployAssets(destinationBucket: s3.Bucket) {
    const assetPath =  path.join(__dirname, '..', this.config.assetPath);
    new s3Deployment.BucketDeployment(this, 'DeployAsset', {
     sources: [
      s3Deployment.Source.asset(assetPath),
     ],
     destinationBucket,
    });
  }

  setupOutput(dist: cloudfront.Distribution) {
    new cdk.CfnOutput(this, 'DistibutionId', {value: dist.distributionId});
    new cdk.CfnOutput(this, 'DistibutionDomainName', {value: dist.distributionDomainName});
    new cdk.CfnOutput(this, 'DomainName', {value: dist.domainName});
  }

  getConfig(): IConfig {
    const binStr = fs.readFileSync(path.join(__dirname, '../src/config.json'));
    return JSON.parse(binStr.toString());
  }
}
