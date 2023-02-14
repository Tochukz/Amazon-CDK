import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Duration, CfnOutput,  } from 'aws-cdk-lib';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

type Queue = sqs.Queue;
type QueueProps = sqs.QueueProps;
type Topic = sns.Topic;
type TopicProps = sns.TopicProps;
type ITopicSubscription = sns.ITopicSubscription;

export class MessagingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const isFifo = false;
    const queue = this.provisionQueue(isFifo);
    const topic = this.provisionTopic(queue, isFifo);
    this.output(queue, topic);
  }

   provisionQueue(isFifo: boolean): Queue {
    const queueName = isFifo ? 'cart-orders.fifo' : 'cart-orders';
    let queueProps: QueueProps = {
      queueName,
      retentionPeriod: Duration.days(2),
      visibilityTimeout: Duration.minutes(1),
      deadLetterQueue: {
        queue: this.deadQueue(isFifo),
        maxReceiveCount: 3,
      },     
    }
    if (isFifo) {
      queueProps = {
        ...queueProps, 
        contentBasedDeduplication: true, 
        fifo: true
      }     
    }
    return new sqs.Queue(this, 'CartOrderQueue', queueProps);
  }

  deadQueue(isFifo: boolean): Queue {
    const queueName = isFifo ? 'cart-order-dead-queue.fifo' : 'cart-order-dead-queue';
    let queueProps: QueueProps = {
      queueName,
    }
    if (isFifo) {
      queueProps = {
        ...queueProps,
        contentBasedDeduplication: true,
        fifo: true,
      }
    }
    return new sqs.Queue(this, 'CartOrderDeadQueue', queueProps);
  }

  provisionTopic(queue: Queue, isFifo: boolean): Topic {
    const topicName = isFifo ? 'cart-order-topic.fifo' : 'cart-order-topic';
    let topicProps: TopicProps = {
      displayName: 'Cart order topic',
      topicName,
    }
    if (isFifo) {
      topicProps = {
        ...topicProps,
        contentBasedDeduplication: true,
        fifo: true,
      }
    }
    const topic = new sns.Topic(this, 'CartOrderTopic', topicProps);
    let subscribers: ITopicSubscription[] = [      
      new subscriptions.SqsSubscription(queue)
    ];
    if (!isFifo) {
      subscribers = subscribers.concat([
        new subscriptions.EmailSubscription('truetochukz@gmail.com'),
        new subscriptions.SmsSubscription('+27633641007'),
        new subscriptions.UrlSubscription('https://ojlinks.tochukwu.xyz/test-sns-subscription'),
      ]);
    }
    subscribers.forEach(subscription => topic.addSubscription(subscription));

    return topic;
  }

  output(queue: Queue, topic: Topic) {
    new CfnOutput(this, 'QueueName', {
      value: queue.queueName
    });
    new CfnOutput(this, 'QueueUrl', {
      value: queue.queueUrl,
    });
    new CfnOutput(this, 'QueueArn', {
      value: queue.queueArn,
    });
    new CfnOutput(this, 'TopicName', {
      value: topic.topicName
    });
    new CfnOutput(this, 'TopicArn', {
      value: topic.topicArn
    });    
  }
}
