const cdk = require('aws-cdk-lib');
const { Match, Template } = require('aws-cdk-lib/assertions');
const LocalCloud = require('../lib/local-cloud-stack');

test('SQS Queue and SNS Topic Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new LocalCloud.LocalCloudStack(app, 'MyTestStack');
  // THEN
  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::SQS::Queue', {
    VisibilityTimeout: 300,
  });

  template.resourceCountIs('AWS::SNS::Topic', 1);
});
