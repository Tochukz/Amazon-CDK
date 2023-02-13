# Plus1 Cloud

## Requirement

Node version >= 14.15.0  
Use the proper node version, for example if you use `nvm`

```
$ nvm use 14.18.2
```

## Setup

**Install and configure AWS CLI**  
To install AWS CLI, see [Installing or updating the latest version of the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)  
After installation configure AWS CLI

```
$ aws configure
```

**Install the CDK CLI**

```
$ npm install -g aws-cdk
$ cdk --version
$ cdk --help
```

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Prepare for and deploy

1. Allocate an elastic IP if you do not already have one

```
$ aws ec2 allocate-address --domain vpc
```

Copy your newly allocated elastic IP to the `elasticIp` property value in the relevant stack config object in `src/config.json`.  
Repeat this for each deployment environment.

2. Bootstrap your environment

```
$ cdk bootstrap aws://your-aws-account-number/aws-region
```

3. You can view existing stacks deployed on your AWS account

```
$ aws cloudformation list-stacks
```

4. Create an IAM user group called `AdminUsers`. This user group will be granted access to the KeyPair. 
5. Request AWS ACM certificate if you have not already done so. Must be in us-east-1 region.  
```
$ aws acm request-certificate --validation-method DNS --domain-name "*.tochukwu.click"  --region us-east-1
$ aws acm describe-certificate --certificate-arn arn:aws:acm:eu-west-2:966727776968:certificate/8c4b515b-08d6-4b8b-b156-44761ff5f3c3 --region us-east-1
```
Add the _Name_ and _Value_ property value of _ResourceRecord_ to your DNS record. 

6. Check the diff to access changes in resources before deploy

```
$ cdk diff Plus1DevStack
```

7. Deploy the stack

```
$ cdk deploy Plus1DevStack
```

## After deploy

**Download Private Key of Keypair**

```bash
# Find the secrets Name or ARN of the Private Key
$ aws secretsmanager list-secrets
# Use the secrets Name or ARN as secret-id to get the secret
$ aws secretsmanager get-secret-value --secret-id your-secret-name --query SecretString --output text > ~/Plus1DevKey.pem
# Make the key file private
$ chmod 400 Plus1DevKey.pem
```

**Get database login**

```bash
# Find the secrets Name or ARN
$ aws secretsmanager list-secrets
# Use the secrets Name or ARN as secret-id to get the secret
$ aws secretsmanager get-secret-value --secret-id your-secret-name --query SecretString --output text > output/dev-db.json
```

**Run post-boot script**

```
$ scp -i Plus1DevKey.pem src/config/post-boot.sh ec2-user@34.249.137.173:~/post-boot.sh
$ ssh -i Plus1DevKey.pem ec2-user@34.249.137.173
$ chmod +x ./post-boot.sh
$ ./post-boot.sh plus1-dev
```

**Configure Virtual Host**

1. Add mapping entry to your host file `/etc/hosts`

```
$ echo '127.0.0.1  api-dev.tochukwu.click' | sudo tee -a /etc/hosts
```

2. Copy Nginx config to EC2 instance

```bash
# Copy site config to home directory
$ scp -i ~/Plus1DevKey.pem src/templates/plus1-dev.conf ec2-user@34.249.137.173:~/plus1-dev.conf
# SSH into EC2 and copy file to sites-available directory
$ ssh -i ec2-user@34.249.137.173
$ sudo cp plus1-dev.conf /etc/nginx/sites-available/
$ sudo ln -s /etc/nginx/sites-available/plus1-dev.conf /etc/nginx/sites-enabled/
```

3. Update `/etc/nginx/nginx.conf` file add insert the following line

```
include /etc/nginx/sites-enabled/*.conf;
```

after

```
include /etc/nginx/conf.d/*.conf;
```

inside the `http` block.

4. Test your Nginx configuration syntax

```
$ nginx -t
```

5. Restart nginx

```
$ sudo service nginx restart
```

6. Setup and start you node.js server using pm2

```
$ pm2 start dist/main.js --name plus1-dev
```

**Configure SSL Certificate**  
Install SSL certificate for the active domains on Nginx server using certbot

```
$ sudo certbot --nginx
```

Follow the prompts.  
Certbot with automatically update the Nginx config for all your sites, adding the relevant directive for HTTPS traffic.

## Common useful commands

- `yarn build` compile typescript to js
- `yarn watch` watch for changes and compile
- `yarn test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

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
$ aws ec2 release-address  --allocation-id eipalloc-xxxxxxx
$ aws secretsmanager list-secrets
$ aws acm delete-certificate --certificate-arn arn::aws:acm:region:xxxxxxx
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
[Subnet Selection for EC2](https://bobbyhadz.com/blog/aws-cdk-subnet-selection)  
[RDS Example in AWS CDK - Complete Guide](https://bobbyhadz.com/blog/aws-cdk-rds-example)   
[Billed for Elastic IP addresses](https://aws.amazon.com/premiumsupport/knowledge-center/elastic-ip-charges/)   
[Elastic IP Addresses Pricing](https://aws.amazon.com/ec2/pricing/on-demand/#Elastic_IP_Addresses)  