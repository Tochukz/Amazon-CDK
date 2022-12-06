import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { KeyPair } from 'cdk-ec2-key-pair';

export class Ec2ServerStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const vpc = this.createVpc();

    const cluster = this.createCluster(vpc);
    

    this.addEC2AutoScaling(vpc, cluster)
   
    const taskDefinition = this.createTaskDefinition();

    /** Create an ECS service  */
    const ecsService  = this.createService(cluster, taskDefinition);

    const targetGroup = this.createLoadBalancer(vpc, ecsService);

    this.addServiceAutoScaling(ecsService, targetGroup);
  }

  createVpc(): ec2.Vpc {
    return new ec2.Vpc(this, 'Ec2StackVpc', {
      natGateways: 0,
      cidr: '10.0.0.0/16',
      maxAzs: 2,
    });
  }

  createCluster(vpc: ec2.Vpc): ecs.Cluster {
    const cluster = new ecs.Cluster(this, 'Ec2StackCluster', {
      clusterName: 'ServerCluster',
      vpc,
    });

    /** The default machineImage will be used which is an automatically updated, ECS-optimized Amazon Linux 2 */
    cluster.addCapacity('ClusterCapacity', {
      minCapacity: 2,
      instanceType: new ec2.InstanceType('t2.micro'),
      desiredCapacity: 3,
    });
    return cluster;
  }

  addEC2AutoScaling(vpc: ec2.Vpc, cluster: ecs.Cluster, key: KeyPair) {
    const isProd = true;
    if (!isProd) {
      return;
    }

    const launchTemplate = new ec2.LaunchTemplate(this, 'ASGLaunchTemplate', {
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      userData: ec2.UserData.forLinux(),
      // keyName: key.keyPairName,
      role: new iam.Role(this, 'LaunchRole', { 
        assumedBy: {
          assumeRoleAction: '', 
          policyFragment: ''
        }
      }),
    });

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, "ProdAutoScaling", {
      vpc, 
      mixedInstancesPolicy: {
        instancesDistribution: {
          onDemandPercentageAboveBaseCapacity: 50,
        },
        launchTemplate
      }
    });
    
    const capacityProvider = new ecs.AsgCapacityProvider(this, "StackCapacityProvider", {
      autoScalingGroup,
      machineImageType: ecs.MachineImageType.AMAZON_LINUX_2,
    });

    cluster.addAsgCapacityProvider(capacityProvider);
  }

  createTaskDefinition(): ecs.Ec2TaskDefinition {
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'AppTaskDefinition', {
      // networkMode: ecs.NetworkMode.BRIDGE,
    });
    taskDefinition.addContainer('DefaultContainer', {
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      memoryLimitMiB: 512,
      portMappings: [{ containerPort: 8081}],
      environment: {
        stage: 'Prod'
      },
      environmentFiles: [
        ecs.EnvironmentFile.fromAsset('./app.env')
      ],
      secrets: {
       // DB_PASSWORD: ecs.Secret.fromSecretsManager(secretsmanager.Secret, "password")
      },
    //  logging: new ecs.AwsLogDriver({ streamPrefix: 'EventDemo', mode: ecs.AwsLogDriverMode.NON_BLOCKING})
    });
    taskDefinition.addVolume({
      name: 'AppVolume',
      efsVolumeConfiguration: {
        fileSystemId: 'EFS'
      }
    });
    return taskDefinition;
  }

  createService(cluster: ecs.Cluster, taskDefinition: ecs.Ec2TaskDefinition): ecs.Ec2Service {
    return  new ecs.Ec2Service(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      assignPublicIp: true,
     // vpcSubnets: ec2.SubnetType,
     // securityGroups: 
     circuitBreaker: { rollback: true}
    });
  }

  createLoadBalancer(vpc: ec2.Vpc, service: ecs.Ec2Service): elbv2.ApplicationTargetGroup {
    const loadBalancer  = new elbv2.ApplicationLoadBalancer(this, 'AppLoadBalancer', {
      vpc,
      internetFacing: true,
    });

    const listener = loadBalancer.addListener('LBListener', {port: 80});
    const targetGroup1 = listener.addTargets('ECS1', {
      port: 80,
      targets: [service]
    });
    /** For more control on the container being used */
    const targetGroup2 = listener.addTargets('ECS2', {
      port: 80,
      targets: [
        service.loadBalancerTarget({
          containerName: 'AppContainer',
          containerPort: 8080
        })
      ]
    });

    return targetGroup1;
    // return targetGroup2;
  }

  addServiceAutoScaling(service: ecs.Ec2Service, targetGroup: elbv2.ApplicationTargetGroup) {
    const scaling  = service.autoScaleTaskCount({maxCapacity: 5});
    scaling.scaleOnCpuUtilization('CPU_Scaling', { targetUtilizationPercent: 50});
    scaling.scaleOnMemoryUtilization('MemoryScaling', { targetUtilizationPercent: 50});
    scaling.scaleOnRequestCount('RequestScaling', { requestsPerTarget: 10000, targetGroup});
  }
}
