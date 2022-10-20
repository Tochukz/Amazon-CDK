#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Plus1CloudStack } from '../lib/plus1-cloud-stack';

const devProps: cdk.StackProps = {
  description: 'Stack for development environment',
  env: {
    region: 'eu-west-2'
  },
  stackName: 'Plus1Dev'
};
const stagingProps: cdk.StackProps = {
  description: 'Stacking for staging environment',
  env: {
    region: 'eu-west-2'
  },
  stackName: 'Plus1UAT'
};
const prodProps: cdk.StackProps = {
  description: 'Stack for production environment',
  env: {
    region: 'eu-west-2'
  },
  stackName: 'Plus1Prod'
};

const app = new cdk.App();
new Plus1CloudStack(app, 'Plus1DevStack', devProps);
new Plus1CloudStack(app, 'Plus1UATStack', stagingProps);
new Plus1CloudStack(app, 'Plus1ProdStack', prodProps);
