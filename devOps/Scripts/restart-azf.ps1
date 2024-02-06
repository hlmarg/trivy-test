$rsg= ""
$azf= ""
az functionapp stop -g $rsg -n $azf
az functionapp start -g $rsg -n $azf


$msiid=Get-AutomationVariable -Name 'msiid'
$tenantid=Get-AutomationVariable -Name 'tenantid'
# Connect to Azure with user-assigned managed identity
Connect-AzAccount -Identity -AccountId $msiid -tenant $tenantid
$rsg= "p1-rsg-usc-hr-operations"
$azf= "p1-azf-usc-hr-operations"
az functionapp stop -g $rsg -n $azf
az functionapp start -g $rsg -n $azf


Workflow start-stop-VMs { 
    $msiid=Get-AutomationVariable -Name 'msiid'
    $tenantid=Get-AutomationVariable -Name 'tenantid'
    # Connect to Azure with user-assigned managed identity
    Connect-AzAccount -Identity -AccountId $msiid -tenant $tenantid

    # set and store context
    $AzureContext = Set-AzContext -SubscriptionName $AzureSubscriptionId
}


#Variables for the script
$rsg= "p1-rsg-usc-hr-operations"
$azf= "p1-azf-usc-hr-operations"
#Login on Azure.
$msiid=Get-AutomationVariable -Name 'msiid'
$tenantid=Get-AutomationVariable -Name 'tenantid'
# Connect to Azure with user-assigned managed identity
Connect-AzAccount -Identity -AccountId $msiid -tenant $tenantid
#Stop the function app
Start-AzFunctionApp -ResourceGroupName $rsg -Name $azf
#Start the function app
Stop-AzFunctionApp -ResourceGroupName $rsg -Name