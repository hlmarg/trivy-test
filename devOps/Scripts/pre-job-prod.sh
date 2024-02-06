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
credfile=~/V5-prod/facebook/credentials.json
if [ -f "$credfile" ] 
then
    echo "removing and Creating" 
    sudo rm ~/V5-prod/facebook/credentials.json
    sudo cp ~/blob/credentials.json ~/V5-prod/facebook/
    sudo chown -R vettxadmin:vettxadmin ~/V5-prod/facebook/credentials.json
else
    echo "Creating from cero" 
    sudo cp ~/blob/credentials.json ~/V5-prod/facebook/
    sudo chown -R vettxadmin:vettxadmin ~/V5-prod/facebook/credentials.json
fi

credfileKSL=~/V5-prod/ksl/credentials-ksl.json

if [ -f "$credfileKSL" ]
then
    echo "removing and Creating KSL credentials" 
    sudo rm ~/V5-prod/ksl/credentials-ksl.json
    sudo cp ~/blob/credentials-ksl.json ~/V5-prod/ksl/
    sudo chown -R vettxadmin:vettxadmin ~/V5-prod/ksl/credentials-ksl.json

else
    echo "Creating from cero KSL credentials" 
    sudo cp ~/blob/credentials-ksl.json ~/V5-prod/ksl/
    sudo chown -R vettxadmin:vettxadmin ~/V5-prod/ksl/credentials-ksl.json
fi

envfile=~/V5-prod/.env
if [ -f "$envfile" ] 
then
    echo "removing and Creating" 
    sudo rm ~/V5-prod/.env
    sudo cp ~/blob/prod.env ~/V5-prod/
    sudo mv ~/V5-prod/prod.env ~/V5-prod/.env
    sudo chown -R vettxadmin:vettxadmin ~/V5-prod/.env
    
else
    echo "Creating from cero"
    sudo cp ~/blob/prod.env ~/V5-prod/
    sudo mv ~/V5-prod/prod.env ~/V5-prod/.env
    sudo chown -R vettxadmin:vettxadmin ~/V5-prod/.env
fi
sudo chmod 666 ~/V5-prod/facebook/credentials.json
sudo umount ~/blob

#Testing line

