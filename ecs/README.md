
# Read Me First

* Part I is to prepare the cluster/instances - you can use only one set of cluster for multiple services(applications/systems) - one time job.
* Part II is to prepare the container image and the task definition. Follow this part if it is needed to create/upload/update a container image.
* Part III is to deploy and test. Follow this part when you need to start a new service or scale the service up/down.
* AWS Management Console GUI changes very often so this guide uses CLI almost at every step.
* CLI helps understand the dependencies better so that CloudFormation can be easier to compose if preferred.
* download and configure aws-cli credentials in advance.
```
$aws configure
```

# Part I (1 - 2)
## 1. Create VPC, Load Balancer and etc,. for deployment
### 1-1. Create a VPC
```
aws ec2 create-vpc --cidr-block <network_range>
```

```
$ aws ec2 create-vpc --cidr-block 10.0.0.0/16
{
    "Vpc": {
        "VpcId": "vpc-3d7ff859", 
        ...
    }
}
```

### 1-2. Create at least 2 subnets in the VPC (at least 2 AZs)
```
aws ec2 create-subnet --vpc-id <vpc_id> --cidr-block <network_range>

aws ec2 modify-subnet-attribute --subnet-id <subnet_id> --map-public-ip-on-launch
```

```
$ aws ec2 create-subnet --vpc-id vpc-3d7ff859 --cidr-block 10.0.1.0/24 --availability-zone ap-northeast-1a
{
    "Subnet": {
        ... 
        "SubnetId": "subnet-e1377b97", 
        ...
    }
}

$ aws ec2 modify-subnet-attribute --subnet-id subnet-e1377b97 --map-public-ip-on-launch

$ aws ec2 create-subnet --vpc-id vpc-3d7ff859 --cidr-block 10.0.2.0/24 --availability-zone ap-northeast-1c
{
    "Subnet": {
        ...
        "SubnetId": "subnet-1ebf3746", 
        ...
    }
}

$ aws ec2 modify-subnet-attribute --subnet-id subnet-1ebf3746 --map-public-ip-on-launch
```

### 1-3. Create an Internet gateway and attach it to the VPC
```
$ aws ec2 create-internet-gateway
{
    "InternetGateway": {
        "InternetGatewayId": "igw-a6f7ccc3",
        ...
    }
}
```

attach it to the VPC
```
aws ec2 attach-internet-gateway --vpc-id <vpc_id> --internet-gateway-id <igw_id>
```

```
$ aws ec2 attach-internet-gateway --vpc-id vpc-3d7ff859 --internet-gateway-id igw-a6f7ccc3
```

### 1-4. Add route to the default root table in order to point all traffic (0.0.0.0/0) to the Internet gateway
```
$ aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-3d7ff859"
{
    "RouteTables": [
        {
            ...
            "RouteTableId": "rtb-058dc561", 
            ...
        }
    ]
}
```

Create route to the default route table
```
aws ec2 create-route --route-table-id <route_table_id> --destination-cidr-block <all_network_arrange> --gateway-id <igw_id>
```

```
$ aws ec2 create-route --route-table-id rtb-058dc561 --destination-cidr-block 0.0.0.0/0 --gateway-id igw-a6f7ccc3
```

### 1-5. Associate both subnets with the route table
```
aws ec2 associate-route-table  --subnet-id <subnet_id> --route-table-id <route_table_id>
```

```
$ aws ec2 associate-route-table  --subnet-id subnet-e1377b97 --route-table-id rtb-058dc561

$ aws ec2 associate-route-table  --subnet-id subnet-1ebf3746 --route-table-id rtb-058dc561
```

### 1-6. Create a security group for Load balancer
```
aws ec2 create-security-group --group-name <security_group> --vpc-id <vpc_id> --description <desc>
```

```
$ aws ec2 create-security-group --group-name sg_alb_docker --vpc-id vpc-3d7ff859 --description "sg for load balancer"
{
    "GroupId": "sg-5de8a63a"
}
```

Set up inbound rules of the security group
```
aws ec2 authorize-security-group-ingress --group-id <security_group_id> --protocol <protocol> --port <port> --cidr <network_range>
```

```
$ aws ec2 authorize-security-group-ingress --group-id sg-5de8a63a --protocol tcp --port 80 --cidr 0.0.0.0/0
```

### 1-7. Create a security group for container instances
```
$ aws ec2 create-security-group --group-name sg_ecs_instance --vpc-id vpc-3d7ff859 --description "sg for ecs instances"
{
    "GroupId": "sg-29e8a64e"
}
```

Set up inbound rules of the security group
```
$ aws ec2 authorize-security-group-ingress --group-id sg-29e8a64e --protocol tcp --port 32768-61000 --source-group sg-5de8a63a
```

### 1-8. create IAM roles for ECS with GUI
ecsInstanceRole with the following policies attached
* AmazonS3ReadOnlyAccess
* AmazonEC2ContainerServiceforEC2Role

ecsServiceRole with the following policies attached
* AmazonEC2ContainerServiceRole

## 2. Create a ECS cluster
### 2-1. Create a cluster
```
aws ecs create-cluster --cluster-name <cluster_name>
```

```
$ aws ecs create-cluster --cluster-name ecs-cluster-demo
```

### 2-2. Create a bucket to save the ECS config file for instances
```
aws s3api create-bucket --bucket <bucket_name>
```

```
$ aws s3api create-bucket --bucket ecs-cluster-demo
```

### 2-3. Configure container agent for Amazon ECS-optimized AMI

[Amazon ECS Container Agent Configuration](http://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-agent-config.html)

ecs.config
```
ECS_CLUSTER=ecs-cluster-demo
```

Copy ecs.config to s3 bucket
```
$ aws s3 cp ./ecs.config s3://ecs-cluster-demo/ecs.config
$ aws s3 ls s3://ecs-cluster-demo
```

Edit the 'copy-ecs-config-from-s3' file for container instances(Amazon ECS-optimized AMI)
```
#!/bin/bash

yum install -y aws-cli
aws s3 cp s3://ecs-cluster-demo/ecs.config /etc/ecs/ecs.config
```

### 2-4. Create a key-pair
```
$ aws ec2 create-key-pair --key-name dockerlab --query 'KeyMaterial' --output text > ./docker.pem
$ chmod 0400 ./docker.pem
```

### 2-5. Start 2 EC2 instances for container instances using the security group created in 1-7 and with the latest Amazon ECS-optimized AMI

[Amazon ECS-optimized AMI List](http://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-optimized_AMI.html)

```
aws ec2 run-instances --image-id <image_id> --count <instance_count> --instance-type <instance_type> --iam-instance-profile Name=<ecs_insrance_role> --key-name <key_pair_name> --security-group-ids <container_security_group> --subnet-id <subnet_id> --user-data <instance_user_data>
```

```
$ aws ec2 run-instances --image-id ami-372f5450 --count 1 --instance-type t2.medium --iam-instance-profile Name=ecsInstanceRole --key-name docker --security-group-ids sg-29e8a64e --subnet-id subnet-e1377b97 --user-data file://copy-ecs-config-from-s3

$ aws ec2 run-instances --image-id ami-372f5450 --count 1 --instance-type t2.medium --iam-instance-profile Name=ecsInstanceRole --key-name docker --security-group-ids sg-29e8a64e --subnet-id subnet-1ebf3746 --user-data file://copy-ecs-config-from-s3
```

# Part II (3)
## 3. Prepare the docker image and task definition
### 3-1. Tag the image built by Dockerfile
[Specified image name and tag](/README.md#2-3-login-and-push-to-docker-hub)

```
$ docker tag <image_id> <ecr_host>/<repo_name>/<image_name>
```

```
$ docker tag 27c33eca314f 042083552617.dkr.ecr.ap-northeast-1.amazonaws.com/komushi/swagger-outlook-api
```

### 3-2. Get login and then login to ecr
```
$ aws ecr get-login
docker login -u AWS -p AQECA... https://042083552617.dkr.ecr.ap-northeast-1.amazonaws.com
```

### 3-3. Create repository
```
aws ecr create-repository --repository-name <repo_name>/<image_name>
```

```
$ aws ecr create-repository --repository-name komushi/swagger-outlook-api
```

### 3-4. Push the image to Amazon ECR
```
docker push <ecr_host>/<repo_name>/<image_name>
```

```
$ docker push 042083552617.dkr.ecr.ap-northeast-1.amazonaws.com/komushi/swagger-outlook-api
```

### 3-5. Register as task definition
Save the contents below as task_definition.json
```
{
  "networkMode": "bridge",
  "containerDefinitions": [
    {
      "memory": 512,
      "portMappings": [
        {
          "hostPort": 0,
          "containerPort": 10010,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "name": "swagger-outlook-api",
      "image": "<your_ecr_container_image_url>"
    }
  ],
  "family": "swagger-outlook-api"
}
```

Register a task definition
```
$ aws ecs register-task-definition --cli-input-json file://task_definition.json
```


# Part III (4 - 5)
## 4. Prepare load balancer and listener before ECS service/task deployment
### 4-1. Create an Application Load Balancer
```
aws elbv2 create-load-balancer --name <load_balancer_name> --subnets <subner_list> --security-groups <load_balancer_security_group>
```

```
$ aws elbv2 create-load-balancer --name alb-outlook-api --subnets subnet-1ebf3746 subnet-e1377b97 --security-groups sg-5de8a63a
{
    "LoadBalancers": [
        {
            "DNSName": "alb-outlook-api-303138750.ap-northeast-1.elb.amazonaws.com", 
            ...
            "LoadBalancerArn": "arn:aws:elasticloadbalancing:ap-northeast-1:042083552617:loadbalancer/app/alb-outlook-api/10850793b6737814", 
            ...
        }
    ]
}
```

### 4-2. Create a target group
```
aws elbv2 create-target-group --name <target_group_name> --protocol <protocol> --port <dummy_port> --vpc-id <vpc_id> --health-check-protocol <check_protocol> --health-check-path <check_path>
```

```
$ aws elbv2 create-target-group --name tg-ecs-demo --protocol HTTP --port 8964 --vpc-id vpc-3d7ff859 --health-check-protocol HTTP --health-check-path /swagger
{
    "TargetGroups": [
        {
            ...
            "TargetGroupArn": "arn:aws:elasticloadbalancing:ap-northeast-1:042083552617:targetgroup/tg-ecs-demo/040622bec6a04e56",
            ...
        }
    ]
}
```

### 4-3. Create a listener
```
aws elbv2 create-listener --load-balancer-arn <load_balancer_arn> --protocol <protocol> --port <port> --default-actions <listener_default_action>
```

```
$ aws elbv2 create-listener --load-balancer-arn arn:aws:elasticloadbalancing:ap-northeast-1:042083552617:loadbalancer/app/alb-outlook-api/10850793b6737814 --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:ap-northeast-1:042083552617:targetgroup/tg-ecs-demo/040622bec6a04e56
```

## 5. Create a service and test
### 5-1. Create a service based on the task definition
```
aws ecs create-service --cluster <cluster> --service-name <service_name> --task-definition <task_definition> --desired-count <container_count> --load-balancers <target_group_arn,container_name,container_port> --role <ecs_service_role>
```

```
$ aws ecs create-service --cluster ecs-cluster-demo --service-name svc-outlook-api --task-definition swagger-outlook-api --desired-count 2 --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:ap-northeast-1:042083552617:targetgroup/tg-ecs-demo/040622bec6a04e56,containerName=swagger-outlook-api,containerPort=10010 --role ecsServiceRole
```

### 5-2. Test the REST methods
```
$ curl -i http://alb-outlook-api-303138750.ap-northeast-1.elb.amazonaws.com/swagger

$ curl -i http://alb-outlook-api-303138750.ap-northeast-1.elb.amazonaws.com/mail?email=xu@cloudnativeltd.onmicrosoft.com

$ curl -i http://alb-outlook-api-303138750.ap-northeast-1.elb.amazonaws.com/event?email=xu@cloudnativeltd.onmicrosoft.com
```

# TODO
* add blue-green deployment guide when a container image need to be changed.
* scale up/down test guide