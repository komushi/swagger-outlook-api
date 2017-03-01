## 1. ECS cluster creation preparation
### 1-1. Set the proper key and secret, use ap-northeast-1
```
$aws configure
```

### 1-2. Create a key-pair
```
$ aws ec2 create-key-pair --key-name dockerlab --query 'KeyMaterial' --output text > ./docker.pem
$ chmod 0400 ./docker.pem
```

### 1-3. Create a security group
```
$ aws ec2 create-security-group --group-name docker_SG --description "sg for docker cluster"
{
    "GroupId": "sg-9acfaefd"
}
```

Set up inbound rules of the security group
```
$ aws ec2 authorize-security-group-ingress --group-id sg-9acfaefd --protocol tcp --port 10010 --cidr 0.0.0.0/0
$ aws ec2 authorize-security-group-ingress --group-id sg-9acfaefd --protocol tcp --port 80 --cidr 0.0.0.0/0
```

### 1-4. create IAM roles for ECS with GUI
ecsInstanceRole with the following policies attached
* AmazonS3ReadOnlyAccess
* AmazonEC2ContainerServiceforEC2Role

ecsServiceRole with the following policies attached
* AmazonEC2ContainerServiceRole

## 2. Create a cluster
### 2-1. Create a cluster
```
$ aws ecs create-cluster --cluster-name demo-docker-cluster
```

### 2-2. Create a bucket to save the ECS config file for instances
```
$ aws s3api create-bucket --bucket demo-docker-cluster
```

### 2-3. Configure container agent for Amazon ECS-optimized AMI

[Amazon ECS Container Agent Configuration](http://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-agent-config.html)

ecs.config
```
ECS_CLUSTER=demo-docker-cluster
```

Copy ecs.config to s3 bucket
```
$ aws s3 cp ./ecs.config s3://demo-docker-cluster/ecs.config
$ aws s3 ls s3://demo-docker-cluster
```

Edit the 'copy-ecs-config-from-s3' file for container instances(Amazon ECS-optimized AMI)
```
#!/bin/bash

yum install -y aws-cli
aws s3 cp s3://demo-docker-cluster/ecs.config /etc/ecs/ecs.config
```

### 2-4. Start 2 EC2 instances for container instances using the security group created in 1-3 and with the latest Amazon ECS-optimized AMI

[Amazon ECS-optimized AMI List](http://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-optimized_AMI.html)
```
$ aws ec2 run-instances --image-id ami-372f5450 --count 2 --instance-type t2.medium --iam-instance-profile Name=ecsInstanceRole --key-name docker --security-group-ids sg-9acfaefd --user-data file://copy-ecs-config-from-s3
```

## 3. Push the docker image onto ECR
### 3-1. Tag the image built by Dockerfile
[Specified image name and tag](/README.md#2-3-login-and-push-to-docker-hub)

```
$ docker tag <image_id> <ecr_host>/<repo_name>/swagger-outlook-api
```

```
$ docker tag ea298e469cc4 042083552617.dkr.ecr.ap-northeast-1.amazonaws.com/komushi/swagger-outlook-api
```

### 3-2. Get login and then login to ecr
```
$ aws ecr get-login
docker login -u AWS -p AQECA... https://042083552617.dkr.ecr.ap-northeast-1.amazonaws.com
```

### 3-3. Create repository
```
$ aws ecr create-repository --repository-name <repo_name>/swagger-outlook-api
```

```
$ aws ecr create-repository --repository-name komushi/swagger-outlook-api
```

### 3-4. Push image to Amazon ECR
```
$ docker push <image_name>
```

```
$ docker push 042083552617.dkr.ecr.ap-northeast-1.amazonaws.com/komushi/swagger-outlook-api
```

## 4. Start service by docker-compose with ecs-cli

### 4-1. Edit the docker-compose-ecs.yml

```
version: '2'
services:
  swagger-outlook-api:
    image: "042083552617.dkr.ecr.ap-northeast-1.amazonaws.com/komushi/swagger-outlook-api:latest"
    ports:
      - 10010
```

### 4-2. ecs-cli Login with your AWS account's access key
```
$ ecs-cli configure --region ap-northeast-1 --access-key <access_key> --secret-key <secret> --cluster demo-docker-cluster
```

### 4-2. Start the service
```
$ ecs-cli compose --file docker-compose-ecs.yml service up
```

```
$ ecs-cli compose --file docker-compose-ecs.yml service scale 2
```

## 5. Add ELB for container instances

### 5-1. Get subnets IDs whose DefaultForAz is true

```
$ aws ec2 describe-subnets
```

```
subnet-0b59ec53 subnet-08a7cb7e
```

### 5-2. Create load balancer
```
$ aws elb create-load-balancer --load-balancer-name docker-outlook-api --listeners "Protocol=HTTP,LoadBalancerPort=80,InstanceProtocol=HTTP,InstancePort=10010" --subnet subnet-0b59ec53 subnet-08a7cb7e --security-groups sg-9acfaefd
{
    "DNSName": "docker-outlook-api-2088626580.ap-northeast-1.elb.amazonaws.com"
}
```

### 5-3. Register instances to load blancer 
```
$ aws elb register-instances-with-load-balancer --load-balancer-name docker-outlook-api --instances i-06e28d2ca86a05793 i-087e947884fbe4987
```

## 6. Test with curl
```
$ curl http://docker-outlook-api-2088626580.ap-northeast-1.elb.amazonaws.com/mail?email=<user>@<org>.onmicrosoft.com
```

```
$ curl http://docker-outlook-api-2088626580.ap-northeast-1.elb.amazonaws.com/mail?email=xu@cloudnativeltd.onmicrosoft.com
```