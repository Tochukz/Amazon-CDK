#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { LocalCloudStack } = require('../lib/local-cloud-stack');

const app = new cdk.App();
new LocalCloudStack(app, 'LocalCloudStack');
