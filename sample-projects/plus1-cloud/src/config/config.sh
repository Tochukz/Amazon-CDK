#!/bin/bash
# Filename: config.sh
# Task: Install dependencies for backend

echo OS Version: 
cat /etc/os-release

sudo yum update -y

## Install Nginx
sudo amazon-linux-extras install nginx1 -y
sudo service nginx start

# Enable Nginx to start at Boot time
sudo chkconfig nginx o

## Install PostgreSQL client (psql)
sudo amazon-linux-extras install postgresql10 -y

## Install Code Deploy 
sudo yum install ruby -y
sudo yum install wget -y
cd /home/ec2-user
wget https://aws-codedeploy-eu-west-2.s3.eu-west-2.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
# check that the service is running
sudo service codedeploy-agent status 

## Install git 
sudo yum install git 

## Install Certbot and certbot nginx plugin
sudo amazon-linux-extras install epel -y
sudo yum install certbot -y
sudo yum install python-certbot-nginx -y