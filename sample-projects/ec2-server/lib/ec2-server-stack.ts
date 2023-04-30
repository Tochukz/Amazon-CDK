import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elb2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';


type Vpc = ec2.Vpc;
type ApplicationLoadBalancer = elb2.ApplicationLoadBalancer;
type AutoScalingGroup = autoscaling.AutoScalingGroup;
export class Ec2ServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = this.provisionVpc();

    const applLoadBalancer = this.provisionLoadBalancer(vpc);

    const autoScalingGroup = this.provisionAutoScalingGroup(vpc);

    this.provisionListeners(applLoadBalancer, autoScalingGroup);

    this.output(applLoadBalancer);
  }

  provisionVpc(): Vpc {
    return new ec2.Vpc(this, `${this.stackName}Vpc`, { natGateways: 1});
  }

  provisionLoadBalancer(vpc: Vpc): ApplicationLoadBalancer {
    return new elb2.ApplicationLoadBalancer(this, `${this.stackName}AppLoadBalancer`, {
      vpc,
      internetFacing: true,
    });
  }

  provisionAutoScalingGroup(vpc: Vpc): AutoScalingGroup {
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'sudo yum update -y',
      'sudo amazon-linux-extras install nginx1 -y',
      'sudo service nginx start',
      'sudo chkconfig nginx o ',
      'echo "<h1>Hello world from ${hostname -f}</h1>" /var/www/html/index.html'
    );

    const stackName = this.stackName;
    const autoScalingGroup =  new autoscaling.AutoScalingGroup(this, `${stackName}AutoScalingGroup`, {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.NANO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
      }),
      userData,
      minCapacity: 2,
      maxCapacity: 3,
    });

    return autoScalingGroup;
  }

  provisionListeners(loadBalancer: ApplicationLoadBalancer, autoScalingGroup: AutoScalingGroup) {
    const stackName = this.stackName;
    const listener = loadBalancer.addListener(`${stackName}Listener`, {
      port: 80,
      open: true,
    });

    listener.addTargets(`${stackName}DefaultTarget`, {
      port: 80,
      targets: [ autoScalingGroup ],
      healthCheck: {
        path: '/',
        unhealthyThresholdCount: 2,
        healthyThresholdCount: 5,
        interval: cdk.Duration.seconds(30),
      }
    });

    listener.addAction('/static', {
      priority: 5,
      conditions: [ elb2.ListenerCondition.pathPatterns(['/static'])],
      action: elb2.ListenerAction.fixedResponse(200, {
        contentType: 'text/html',
        messageBody: '<h1>Static ALB Response</h1>',
      })
    })

    autoScalingGroup.scaleOnRequestCount(`${stackName}ScaleOnRequstRate`, {
      targetRequestsPerMinute: 60,
     });
     autoScalingGroup.scaleOnCpuUtilization(`${stackName}ScaleOnCpuUsage`, {
       targetUtilizationPercent: 75,
     });
  }

  output(loadBalancer: ApplicationLoadBalancer) {
    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: loadBalancer.loadBalancerDnsName,
    })
  }
}
