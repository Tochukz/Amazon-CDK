# Welcome to your CDK TypeScript project
The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful CDK commands
* `cdk list`        list all the stacks 
* `cdk deploy`      deploy this stack to your default AWS account/region 
* `cdk deploy stackName` deploy a specific stack in the case of multiple stacks
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template 

## Useful AWS-CLI command 
```bash
$ aws iam list-groups 
$ aws ec2 describe-key-pairs
$ aws ec2 describe-instance-types
$ aws ec2 describe-images
$ aws cloudformation describe-stacks 
$ aws ec2 describe-addresses
$ aws ec2 allocate-address --domain vpc
$ aws secretsmanager list-secrets
```
## Common Operations
__To download your EC2 keypair from AWS SecretManager__   
```bash
$ aws secretsmanager get-secret-value --secret-id ec2-ssh-key/Plus1LinuxKey/private --query SecretString --output text > Plus1LinuxKey.pem 
$ chmod 400 Plus1LinuxKey.pem
```

__To retrive your DB username/password from AWS SecretsManager__  
```bash
# Copy the DBSecretName from the deploy output or 
# list all your account secrets and copy the Name of the relevant secret
$ aws secretsmanager list-secrets 
# view the secret details
$ aws secretsmanager get-secret-value --secret-id MySecretName-xyzabc
```

__SSH into EC2 instance__  
```bash
$ ssh -i cdk-key.pem -o IdentitiesOnly=yes ec2-user@xx.xxxx.xxx
```


## Finiancial Consideration
- NAT Gateways have an hourly billing rate of about $0.045 in the us-east-1 region. Check your `natGateways` property of you Vpc construct. 
- An Elastic IP address incur charges per hour if they are not associated with a running instance 

## References 
[IAM Construct Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam-readme.html)  
[EC2 Construct Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2-readme.html)  
[Subntet Selection for EC2](https://bobbyhadz.com/blog/aws-cdk-subnet-selection)  
[RDS Example in AWS CDK - Complete Guide](https://bobbyhadz.com/blog/aws-cdk-rds-example)   
[Billed for Elastic IP addresses](https://aws.amazon.com/premiumsupport/knowledge-center/elastic-ip-charges/)   
[Elastic IP Addresses Pricing](https://aws.amazon.com/ec2/pricing/on-demand/#Elastic_IP_Addresses)  