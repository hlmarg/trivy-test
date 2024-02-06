#UnTar all the code on the Home path.
if [ "$2" == "prod" ] 
then
    rm -r V5-prod
    tar -xvf V5.tar.gz
    rm V5.tar.gz  
    echo "Configure the modules for Prod"
    npm install --prefix ~/V5-prod  
else
    rm -r V5
    tar -xvf V5.tar.gz
    rm V5.tar.gz
    echo "Configure the modules for non-prod"
    npm install --prefix ~/V5
fi

#Configure the fstab to the NFS storage Account
echo "Configure the fstab"
status=$(findmnt -T /home/vettxadmin/blob -t nfs -n)
if [ ! -z "$status" ] 
then
    sudo umount ~/blob
fi
fstab=$(sudo cat /etc/fstab |grep ~/blob)
if [ "$fstab" != "$1" ]
then
    echo "Update the fstab record."
    line=$(sudo grep -n ~/blob /etc/fstab | cut -d : -f 1)
    line+=d
    sudo sed -i $line /etc/fstab
    echo "$1" | sudo tee -a /etc/fstab
fi

#Create the crontab jobs on the VM.
crontab -r

#Create the crontab jobs on the VM for est time zone.
(crontab -l 2>/dev/null; echo "00 14 * * * ~/devOps/Scripts/jobs/job-prod-midnight-03.sh est") | crontab - # Other
(crontab -l 2>/dev/null; echo "00 14 * * * ~/devOps/Scripts/jobs/job-prod-midnight-04.sh est") | crontab - # Cars.com

(crontab -l 2>/dev/null; echo "00 07 * * * ~/devOps/Scripts/jobs/job-prod-03.sh est") | crontab - # Other
(crontab -l 2>/dev/null; echo "00 07 * * * ~/devOps/Scripts/jobs/job-prod-04.sh est") | crontab - # Cars.com

#Create the crontab jobs on the VM for cst time zone.
(crontab -l 2>/dev/null; echo "00 19 * * * ~/devOps/Scripts/jobs/job-prod-midnight-03.sh cst") | crontab - # Other 
(crontab -l 2>/dev/null; echo "00 19 * * * ~/devOps/Scripts/jobs/job-prod-midnight-04.sh cst") | crontab - # Cars.com 

(crontab -l 2>/dev/null; echo "00 09 * * * ~/devOps/Scripts/jobs/job-prod-03.sh cst") | crontab - # Other
(crontab -l 2>/dev/null; echo "00 09 * * * ~/devOps/Scripts/jobs/job-prod-04.sh cst") | crontab - # Cars.com

#Create the crontab jobs on the VM for mst time zone.
(crontab -l 2>/dev/null; echo "00 22 * * * ~/devOps/Scripts/jobs/job-prod-midnight-03.sh mst") | crontab - # Other 
(crontab -l 2>/dev/null; echo "00 22 * * * ~/devOps/Scripts/jobs/job-prod-midnight-04.sh mst") | crontab - # Cars.com 

(crontab -l 2>/dev/null; echo "00 11 * * * ~/devOps/Scripts/jobs/job-prod-03.sh mst") | crontab - # Other
(crontab -l 2>/dev/null; echo "00 11 * * * ~/devOps/Scripts/jobs/job-prod-04.sh mst") | crontab - # Cars.com

#Create the crontab jobs on the VM for pst time zone.
(crontab -l 2>/dev/null; echo "00 01 * * * ~/devOps/Scripts/jobs/job-prod-midnight-03.sh pst") | crontab - # Other 
(crontab -l 2>/dev/null; echo "00 01 * * * ~/devOps/Scripts/jobs/job-prod-midnight-04.sh pst") | crontab - # Cars.com 

(crontab -l 2>/dev/null; echo "00 13 * * * ~/devOps/Scripts/jobs/job-prod-03.sh pst") | crontab - # Other
(crontab -l 2>/dev/null; echo "00 13 * * * ~/devOps/Scripts/jobs/job-prod-04.sh pst") | crontab - # Cars.com

crontab -l
