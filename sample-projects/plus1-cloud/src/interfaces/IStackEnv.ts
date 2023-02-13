export interface IStackEnv {
  elasticIp: string;
  dbname: string;
  originBucketName: string;
  certificateArn: string;
  domainNames: string[];
  assetPath: string;
  dbUser: string;
  dbRemoval: boolean;
  cognitoRemoval: boolean;
}
