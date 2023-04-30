import { join } from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { KeyPair } from 'cdk-ec2-key-pair';
import { ManagedPolicy, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { SecretValue } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';

type Vpc = ec2.Vpc;
type Cluster =  ecs.Cluster;
type Ec2TaskDefinition = ecs.Ec2TaskDefinition;
type Ec2Service = ecs.Ec2Service;
type LoadBalancer = elbv2.ApplicationLoadBalancer;
export class Ec2ContainersStack extends cdk.Stack {

  containerName: 'express-app';

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = this.provisionVpc();
    const cluster = this.provisionCluster(vpc);
    const task  = this.createTask();
    const loadbalancer = this.createService(vpc, cluster, task);
    this.output(loadbalancer);
  }

  provisionVpc(): Vpc {
    return new ec2.Vpc(this, `${this.stackName}Vpc`, {
      cidr: '10.0.0.0/16',
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          cidrMask: 28,
          name: 'IsolatedSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ]
    });
  }

  provisionCluster(vpc: Vpc): Cluster {
    const cluster =  new ecs.Cluster(this, `${this.stackName}Cluster`, { vpc });
    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, `${this.stackName}ASG`, {
      vpc,
      instanceType: new ec2.InstanceType('t2.nano'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      desiredCapacity: 2,
    });
    const capacityProvider = new ecs.AsgCapacityProvider(this, `${this.stackName}AsgCapacityProvider`, {
      autoScalingGroup,
    });
    cluster.addAsgCapacityProvider(capacityProvider);

    return cluster;
  }

  createTask(): Ec2TaskDefinition {
    const taskDefinition = new ecs.Ec2TaskDefinition(this, `${this.stackName}TaskDef`, {
      networkMode: ecs.NetworkMode.AWS_VPC
    });
    // const image =  ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample');
    // const image = ecs.ContainerImage.fromEcrRepository();
    const dockerDir = join(__dirname, '../../../express-app')
    const image = ecs.ContainerImage.fromAsset(dockerDir);

    taskDefinition.addContainer(`${this.stackName}DefaultContainer`, {
      image,
      containerName: this.containerName,
      memoryLimitMiB: 512,
      portMappings: [{ containerPort: 8080 }],
      environment: {
        NODE_ENV: 'development'
      },
      environmentFiles: [
        ecs.EnvironmentFile.fromAsset(`${dockerDir}/development.env`),
      ],
      // secrets: {
      //   SECRET: ecs.Secret.fromSecretsManager(secret),
      // }
    });
    taskDefinition.addVolume({
      name: `${this.stackName}DataVolume`,
    })
    return taskDefinition
  }

  createService(vpc: Vpc, cluster: Cluster, taskDefinition: Ec2TaskDefinition): LoadBalancer {
    const service =  new ecs.Ec2Service(this, `${this.stackName}Service`, {
      cluster,
      taskDefinition,
      desiredCount: 2,
      // securityGroups: []
      circuitBreaker: { rollback: true}
    });

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, `${this.stackName}LB`, {
      vpc,
      internetFacing: true,
    });
    const listener = loadBalancer.addListener(`${this.stackName}Listener`, { port: 80 });
    const targetGroup = listener.addTargets(`${this.stackName}Target`, {
      port: 80,
      targets: [ 
        service
      ],
    });

    const scaling =  service.autoScaleTaskCount({ maxCapacity: 10 });
    scaling.scaleOnCpuUtilization(`${this.stackName}CpuScaling`, {
      targetUtilizationPercent: 50,
    });
    scaling.scaleOnRequestCount(`${this.stackName}RequestScaling`, {
      requestsPerTarget: 1000,
      targetGroup,
    })
    return loadBalancer;
  }

  output(loadBalancer: LoadBalancer) {
    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: loadBalancer.loadBalancerDnsName,
    });
  }
}
