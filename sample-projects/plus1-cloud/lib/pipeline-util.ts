import * as dotenv from "dotenv";
import * as iam from "aws-cdk-lib/aws-iam";
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";
import { Plus1CloudStack } from "./plus1-cloud-stack";
import { IStackEnv } from "../src/interfaces/IStackEnv";

type CfnApplication = codedeploy.CfnApplication;
type CfnDeploymentGroup = codedeploy.CfnDeploymentGroup;
type Role = iam.Role;

export type DeploymentAppAndGroup = {
  deploymentApp: CfnApplication;
  deploymentGroup: CfnDeploymentGroup;
  codeDeployRole: Role;
};

export class PipelineUtil {
  stack: Plus1CloudStack;

  config: IStackEnv;

  stackName: string;

  constructor(stack: Plus1CloudStack) {
    dotenv.config();

    this.stack = stack;
    this.config = stack.stackConfig;
    this.stackName = stack.stackProps.stackName || "";
  }

  createUserRole(): Role {
    const stackName = this.stackName;
    const stack = this.stack;

    const role = new iam.Role(stack, `${stackName}CodeDeployRole`, {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("ec2.amazonaws.com"),
        new iam.ServicePrincipal(`codedeploy.${stack.stackProps.env?.region}.amazonaws.com`)
      ),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["s3:*"],
      })
    );

    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2FullAccess")
    );
    return role;
  }

  createDeploymentApp(): DeploymentAppAndGroup {
    const codeDeployRole = this.createUserRole();
    const stackName = this.stackName;
    const applicationName = `${stackName}CodeDeployApplication`;
    const deploymentApp = new codedeploy.CfnApplication(
      this.stack,
      `${stackName}CodeDeployApp`,
      {
        applicationName,
      }
    );
    const deploymentGroup = this.createDeploymentGroup(deploymentApp, codeDeployRole);
    return { deploymentApp, deploymentGroup, codeDeployRole };
  }

  private createDeploymentGroup(
    app: CfnApplication,
    codeDeployRole: Role
  ): CfnDeploymentGroup {
    const stackName = this.stackName;
    const deploymentGroup = new codedeploy.CfnDeploymentGroup(
      this.stack,
      `${stackName}CodeDeployGp`,
      {
        applicationName: app.applicationName || "",
        deploymentGroupName: `${stackName}CodeDeployGroup`,
        serviceRoleArn: codeDeployRole.roleArn,
        deploymentConfigName: "CodeDeployDefault.OneAtATime",
        deploymentStyle: {
          deploymentType: "IN_PLACE",
          deploymentOption: "WITHOUT_TRAFFIC_CONTROL",
        },
        ec2TagSet: {
          ec2TagSetList: [
            {
              ec2TagGroup: [
                {
                  key: "server",
                  type: "KEY_AND_VALUE",
                  value: this.stack.ec2TagValue,
                },
              ],
            },
          ],
        },
      }
    );
    return deploymentGroup;
  }
}
