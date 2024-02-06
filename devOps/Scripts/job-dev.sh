#Create the log file name
name="$(date +"%d-%m-%H-%M")-dev-cronlog.log"

#Validate the Vm Configuration.
/bin/bash ~/devOps/Scripts/pre-job.sh >> ~/logs/$name

#Running the Vettx Script and Poweroff the VM if the node command was successful 
cd ~/V5
/usr/bin/node ~/V5/index.js --useThreads --ksl --cargurus --maxResults=50 >> ~/logs/$name
