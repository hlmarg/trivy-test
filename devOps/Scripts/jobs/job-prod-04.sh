#Create the log file name
timeZone="$1"
name="$(date +"%d-%m-%H-%M")-prod-$timeZone-04-cronlog.log"

#Validate the Vm Configuration.
/bin/bash ~/devOps/Scripts/pre-job-prod.sh >> ~/logs/$name

#Running the Vettx Script and Poweroff the VM if the node command was successful 
cd ~/V5-prod
/usr/bin/node ~/V5-prod/index.js --useThreads --ksl --timeZone=$timeZone >> ~/logs/$name 