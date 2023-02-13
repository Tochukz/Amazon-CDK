import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { KeyPair } from "cdk-ec2-key-pair";
import { IUserPoolAndClient } from "./IUserPoolClient";
import { DistAndBucket } from "../../lib/frontend-resources";
import { DeploymentAppAndGroup } from "../../lib/pipeline-util";

export interface IOutputParams {
  ec2Instance: ec2.Instance;
  dbInstance: rds.DatabaseInstance;
  key: KeyPair;
  userPoolAndClient: IUserPoolAndClient;
  distAndBucket: DistAndBucket;
  deploymentAppAndGroup: DeploymentAppAndGroup;
}
