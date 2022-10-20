#!/bin/bash
# Filename: config.sh
# Task: Install LAMP stack on AmazonLinux2 EC2 instance

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

## Install Node.js and 
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 16.17.1

## 
npm install -g yarn
npm install -g pm2@latest

# echo 127.0.0.1 site.mydomain.com >> /etc/hosts
