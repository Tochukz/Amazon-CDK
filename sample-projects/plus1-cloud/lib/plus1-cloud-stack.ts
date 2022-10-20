import { join } from 'path';
import { readFileSync } from 'fs';
import { Duration, Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import { KeyPair } from 'cdk-ec2-key-pair';
import { Construct } from 'constructs';
 
import { IStackEnv } from './../src/interfaces/IStackEnv';
import { IConfig } from './../src/interfaces/IConfig';

export class Plus1CloudStack extends Stack {
  stackProps: StackProps = {};

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.stackProps = props || {};

    const key =  this.createKeyPair();
    
    const vpc = this.provisionVpc();

    const securityGroup = this.createSecurityGroups(vpc);

    const ec2Instance = this.provisionEc2Instance(vpc, securityGroup, key);
    
    this.associateEipToEc2(ec2Instance);

    this.addUserData(ec2Instance);

    const dbInstance = this.provisionDbInstance(vpc, ec2Instance);

    this.setupOutput(ec2Instance, dbInstance, key);
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
      description: 'EC2 Keypair for Plus1 EC2 instances',
      storePublicKey: true, // Stores the public key in Secret Manager
    });
    key.grantReadOnPrivateKey(group);
    key.grantReadOnPublicKey(group);
    return key
  }

  provisionVpc(): ec2.Vpc {
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

  createSecurityGroups(vpc: ec2.Vpc): ec2.SecurityGroup {
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

  provisionEc2Instance(vpc: ec2.Vpc, securityGroup: ec2.SecurityGroup, key: KeyPair ): ec2.Instance {
    const machineImage = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });
    const stackName = this.stackProps.stackName;
    let instanceType = ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO);
    if (stackName == 'Plus1Prod') {
      instanceType = ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL);
    }
  
    return new ec2.Instance(this, `${stackName}EC2Instance`, {
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
    });
  }

  associateEipToEc2(ec2Instance: ec2.Instance) {
    const stackName = this.stackProps.stackName;
    new ec2.CfnEIPAssociation(this, `${stackName}ElasticIPAssoc`, {
      eip: this.stackConfig.elasticIp,
      instanceId: ec2Instance.instanceId,
    });
  }

  addUserData(ec2Instance: ec2.Instance) {
    const userDataScript = readFileSync(join(__dirname, '../src/config/config.sh'), 'utf8');
    ec2Instance.addUserData(userDataScript);
  }

  provisionDbInstance(vpc: ec2.Vpc, ec2Instance: ec2.Instance): rds.DatabaseInstance {
    const stackName = this.stackProps.stackName;
    let instanceType = ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);
    if (stackName == 'Plus1Prod') {
      instanceType = ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL);
    }

    const username = this.randomUsername(10);
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
      credentials: rds.Credentials.fromGeneratedSecret(username), // password will be auto-generated and stored in secret manager
      multiAz: false, // use true in production 
      allocatedStorage: 100, 
      maxAllocatedStorage: 105,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      backupRetention: Duration.days(0), // set to 1 for production (default is 1)
      deleteAutomatedBackups: true, // use false for production (default is false)
      removalPolicy: RemovalPolicy.DESTROY, // use RETAIN or SNAPSHOT in production 
      deletionProtection: false, // set to true in production 
      publiclyAccessible: false,
    });

    dbInstance.connections.allowFrom(ec2Instance, ec2.Port.tcp(5432));
    return dbInstance;
  }

  setupOutput(ec2Instance: ec2.Instance, dbInstance:  rds.DatabaseInstance,key: KeyPair) {
    new CfnOutput(this, 'PublicIP', { value: ec2Instance.instancePublicIp });
    new CfnOutput(this, 'EC2KeyName', { value: key.keyPairName });
    new CfnOutput(this, 'DBSecretName', { value: dbInstance.secret?.secretName! })
    new CfnOutput(this, 'DBEndpoint', { value: dbInstance.dbInstanceEndpointAddress});
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

  randomUsername(len: number): string {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charLen = chars.length;
    for (let i = 0; i < len; i++ ) {
      result += chars.charAt(Math.floor(Math.random() * charLen));
    }
    return result;
  }
}
