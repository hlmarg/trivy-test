#connect to azure
az login --identity
#poweroff the VM.
vmname=$(hostname)
az vm deallocate -g d1-rsg-uwe-VM-01 -n $vmname
