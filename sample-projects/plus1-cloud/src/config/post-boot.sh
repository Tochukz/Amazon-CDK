## Install Node.js and other dependencies
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 16.17.1

npm install -g yarn
npm install -g pm2@latest
npm install -g @nestjs/cli

# link binary to the bin path to avoid _not found_ error in your build.  
sudo ln -s /home/ec2-user/.nvm/versions/node/v16.17.1/bin/node /usr/bin/node
sudo ln -s /home/ec2-user/.nvm/versions/node/v16.17.1/bin/npm /usr/bin/npm
sudo ln -s /home/ec2-user/.nvm/versions/node/v16.17.1/bin/yarn /usr/bin/yarn
sudo ln -s /home/ec2-user/.nvm/versions/node/v16.17.1/bin/pm2 /usr/bin/pm2
sudo ln -s /home/ec2-user/.nvm/versions/node/v16.17.1/bin/nest /usr/bin/nest

sitename=$1
sudo mkdir /etc/nginx/sites-available
sudo mkdir /etc/nginx/sites-enabled
sudo mkdir -p /var/www/$sitename/html
sudo chown -R $USER:$USER /var/www/$sitename/html
sudo chmod -R 755 /var/www
sudo touch /var/www/$sitename/html/index.html
echo "<p>Hello EC2 on AWS Linux 2</p>" | sudo tee -a /var/www/$sitename/html/index.html
