import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';


export class FargateServerStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'FargateStackVpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
    });

    const cluster = new ecs.Cluster(this, 'FargetStackCluster', {
      clusterName: 'ServerCluster',
      vpc,
    });
    
  }
}
