#Validate the Folder Exists
if [ -d "~/blob" ] 
then
    echo "Directory exists." 
else
    sudo mkdir -p ~/blob
fi
#Mount the Storage account
sudo mount ~/blob
#Copy the Credentials file
credfile=~/V5/facebook/credentials.json
if [ -f "$credfile" ] 
then
    echo "removing and Creating" 
    sudo rm ~/V5/facebook/credentials.json
    sudo cp ~/blob/credentials.json ~/V5/facebook/
    sudo chown -R vettxadmin:vettxadmin ~/V5/facebook/credentials.json
else
    echo "Creating from cero" 
    sudo cp ~/blob/credentials.json ~/V5/facebook/
    sudo chown -R vettxadmin:vettxadmin ~/V5/facebook/credentials.json
fi

credfileKSL=~/V5/ksl/credentials-ksl.json

if [ -f "$credfileKSL" ]
then
    echo "removing and Creating KSL credentials" 
    sudo rm ~/V5/ksl/credentials-ksl.json
    sudo cp ~/blob/credentials-ksl.json ~/V5/ksl/
    sudo chown -R vettxadmin:vettxadmin ~/V5/ksl/credentials-ksl.json

else
    echo "Creating from cero KSL credentials" 
    sudo cp ~/blob/credentials-ksl.json ~/V5/ksl/
    sudo chown -R vettxadmin:vettxadmin ~/V5/ksl/credentials-ksl.json
fi

envfile=~/V5/.env
if [ -f "$envfile" ] 
then
    echo "removing and Creating" 
    sudo rm ~/V5/.env
    sudo cp ~/blob/dev.env ~/V5/
    sudo mv ~/V5/dev.env ~/V5/.env
    sudo chown -R vettxadmin:vettxadmin ~/V5/.env
    
else
    echo "Creating from cero"
    sudo cp ~/blob/dev.env ~/V5/
    sudo mv ~/V5/dev.env ~/V5/.env
    sudo chown -R vettxadmin:vettxadmin ~/V5/.env
fi
sudo chmod 666 ~/V5/facebook/credentials.json
sudo chmod 666 ~/V5/ksl/credentials-ksl.json
sudo umount ~/blob

#Testing line

