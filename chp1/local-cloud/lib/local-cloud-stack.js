const cdk = require('aws-cdk-lib');
const sns = require('aws-cdk-lib/aws-sns');
const subs = require('aws-cdk-lib/aws-sns-subscriptions');
const sqs = require('aws-cdk-lib/aws-sqs');
const s3 = require('aws-cdk-lib/aws-s3');

class LocalCloudStack extends cdk.Stack {
  /**
   * @param {cdk.App} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, 'LocalCloudQueue', {
      visibilityTimeout: cdk.Duration.seconds(300)
    });

    const topic = new sns.Topic(this, 'LocalCloudTopic');

    topic.addSubscription(new subs.SqsSubscription(queue));

    new s3.Bucket(this, "MyFirstBucket", {
      bucketName: "hello-aws-cdk-my-first-bucket",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}

module.exports = { LocalCloudStack }
