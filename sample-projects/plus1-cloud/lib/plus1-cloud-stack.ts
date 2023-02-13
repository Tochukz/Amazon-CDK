import { FrontendResources } from './frontend-resources';
import { CongnitoUtil } from './cognito.util';
import { PipelineUtil } from './pipeline-util';
import { join } from 'path';
import { readFileSync } from 'fs';
import { Duration, Stack, StackProps, CfnOutput, RemovalPolicy , Tags} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import { KeyPair } from 'cdk-ec2-key-pair';
import { Construct } from 'constructs';
 
import { IStackEnv } from './../src/interfaces/IStackEnv';
import { IConfig } from './../src/interfaces/IConfig';
import { IOutputParams } from '../src/interfaces/IOutputParams';

type Vpc = ec2.Vpc;
type SecurityGroup = ec2.SecurityGroup;
type Instance = ec2.Instance;
type DatabaseInstance = rds.DatabaseInstance;
type Role = iam.Role;
export class Plus1CloudStack extends Stack {
  stackProps: StackProps = {};

  ec2TagValue = "";

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.stackProps = props || {};

    this.ec2TagValue = `${this.stackProps.stackName}Server`;

    const key =  this.createKeyPair();
    
    const vpc = this.provisionVpc();

    const securityGroup = this.createSecurityGroups(vpc);

    const deploymentAppAndGroup =  new PipelineUtil(this).createDeploymentApp();

    const ec2Instance = this.provisionEc2Instance(vpc, securityGroup, key, deploymentAppAndGroup.codeDeployRole);
    
    this.associateEipToEc2(ec2Instance);

    this.addUserData(ec2Instance);

    const dbInstance = this.provisionDbInstance(vpc, ec2Instance);

    const userPoolAndClient = CongnitoUtil.createUserPool(this);

    const distAndBucket = new FrontendResources(this).provisionResources();

    this.setupOutput({
      ec2Instance, 
      dbInstance, 
      key,
      userPoolAndClient,
      distAndBucket, 
      deploymentAppAndGroup,
    });
  }

  /**
   * Create keypair and grant privillege to existing IAM group
   * @returns void 
   */
  createKeyPair(): KeyPair {
    // const group = iam.Group.fromGroupArn(this, 'UserGroup', 'arn:aws:iam::966727776968:group/CLIUsers');
    const group = iam.Group.fromGroupName(this, 'UserGroup', 'CLIUsers');
    const stackName = this.stackProps.stackName;
    const key = new KeyPair(this, `${stackName}EC2KeyPair`, {
      name: `${stackName}Key`,
      description: `EC2 Keypair for ${stackName} EC2 instances`,
      storePublicKey: true, // Stores the public key in Secret Manager
    });
    key.grantReadOnPrivateKey(group);
    key.grantReadOnPublicKey(group);
    return key
  }

  provisionVpc(): Vpc {
    const stackName = this.stackProps.stackName;
    return new ec2.Vpc(this, `${stackName}VPC`, {
      cidr: '10.0.0.0/16',
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,          
        },
        {
          cidrMask: 28, 
          name: 'IsolatedSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ]
    });
  }

  createSecurityGroups(vpc: ec2.Vpc): SecurityGroup {
    const stackName = this.stackProps.stackName;
    const securityGroup =  new ec2.SecurityGroup(this, `${stackName}SecurityGroup`, {
      vpc, 
      description: 'Security group for Linux instance',
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH access');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP access');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS access');
    return securityGroup;
  }

  provisionEc2Instance(vpc: Vpc, securityGroup: SecurityGroup, key: KeyPair, role: Role ): Instance {
    const machineImage = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });
    const stackName = this.stackProps.stackName;
    let instanceType = ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO);
    if (stackName == 'Plus1Prod') {
      instanceType = ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL);
    }
  
    const instance = new ec2.Instance(this, `${stackName}EC2Instance`, {
      instanceName: `${stackName}Instance`,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
        // subnetGroupName: 'PublicSubnet', // Not needed since we have only 1 public subnet
      },
      instanceType,
      keyName: key.keyPairName,
      machineImage,
      securityGroup,
      role,
    });

    Tags.of(instance).add("server", this.ec2TagValue);
    return instance;
  }

  associateEipToEc2(ec2Instance: Instance) {
    const stackName = this.stackProps.stackName;
    new ec2.CfnEIPAssociation(this, `${stackName}ElasticIPAssoc`, {
      eip: this.stackConfig.elasticIp,
      instanceId: ec2Instance.instanceId,
    });
  }

  addUserData(ec2Instance: Instance) {
    const userDataScript = readFileSync(join(__dirname, '../src/config/config.sh'), 'utf8');
    ec2Instance.addUserData(userDataScript);
  }

  provisionDbInstance(vpc: Vpc, ec2Instance: Instance): DatabaseInstance {
    const stackName = this.stackProps.stackName;
    let instanceType = ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);
    let multiAz = false;
    let allocatedStorage = 20;
    if (stackName == 'Plus1Prod') {
      instanceType = ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL);
      multiAz = true;
    }

    let removalPolicy = RemovalPolicy.RETAIN;
    if (this.stackConfig.dbRemoval) {
      removalPolicy = RemovalPolicy.DESTROY;
    }
  
    const dbInstance  = new rds.DatabaseInstance(this, `${stackName}DatabaseInstance`, {
      databaseName: this.stackConfig.dbname,
      vpc, 
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14_3,
      }),
      instanceType,
      credentials: rds.Credentials.fromGeneratedSecret(this.stackConfig.dbUser), // password will be auto-generated and stored in secret manager
      multiAz, 
      allocatedStorage, 
      maxAllocatedStorage: 30,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      backupRetention: Duration.days(0), // set to 1 for production (default is 1)
      deleteAutomatedBackups: true, // use false for production (default is false)
      removalPolicy,
      deletionProtection: false, // set to true in production 
      publiclyAccessible: false,
    });

    dbInstance.connections.allowFrom(ec2Instance, ec2.Port.tcp(5432));
    return dbInstance;
  }

  setupOutput(outputParams: IOutputParams) {
    const {
      ec2Instance,
      dbInstance,
      key,
      userPoolAndClient,
      distAndBucket,
      deploymentAppAndGroup,
    } = outputParams;
    new CfnOutput(this, "PublicIP", {
      value: ec2Instance.instancePublicIp,
    });
    new CfnOutput(this, "EC2KeyName", {
      value: key.keyPairName,
    });
    new CfnOutput(this, "DBSecretName", {
      value: dbInstance.secret?.secretName!,
    });
    new CfnOutput(this, "DBEndpoint", {
      value: dbInstance.dbInstanceEndpointAddress,
    });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolAndClient.client.userPoolClientId,
    });
    new CfnOutput(this, "UserPoolId", {
      value: userPoolAndClient.userPool.userPoolId,
    });   
    new CfnOutput(this, "DomainName", {
      value: distAndBucket.distribution.domainName,
    });
    new CfnOutput(this, "s3OriginServer", {
      value: distAndBucket.bucket.bucketName,
    });
    new CfnOutput(this, "DistributionId", {
      value: distAndBucket.distribution.distributionId,
    });
    new CfnOutput(this, "CodeDeployApplication", {
      value: deploymentAppAndGroup.deploymentApp.applicationName || "",
    });
    new CfnOutput(this, "CodeDeployGroup", {
      value: deploymentAppAndGroup.deploymentGroup.deploymentGroupName || "",
    });
  }
  
  /* 
   * @override: limits the availability zones that could be selected
   */
  get availabilityZones(): string[] {
    return ['eu-west-2a', 'eu-west-2b'];
  }

  get stackConfig(): IStackEnv {
    const binary = readFileSync(join(__dirname, '../src/config/config.json'));
    const config = JSON.parse(binary.toString()) as IConfig;
    const stackName = this.stackProps.stackName || '';
    const stackConfig = (config as any)[stackName];
    if (!stackConfig) {
      throw new Error(`null or unsupported stack name: ${stackName}`);
    }
    return stackConfig as IStackEnv;
  }
}
