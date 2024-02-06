# Input bindings are passed in via param block.
param($Timer)

# Connecto to the Azure Subscription
$context= Get-AzContext
if ($context -ne $null){
    Write-Output "Disconnecting the current session"
    Disconnect-AzAccount
}
$secPassword = ConvertTo-SecureString $ENV:spn_clientSecret -AsPlainText -Force
$Credential = New-Object -TypeName System.Management.Automation.PSCredential -ArgumentList $ENV:spn_clientId, $secPassword
Connect-AzAccount -ServicePrincipal -TenantId $ENV:spn_tenantId -Credential $Credential
Select-AzSubscription -SubscriptionId df564b36-dc70-4793-bcbf-dd5b92cb43ff

# Get the list of containers
$containers = Get-AzContainerGroup -ResourceGroupName $ENV:rsg_scraping 

foreach ($container in $containers) {
    $aciinstance = $container.Name
    $resourceGroupName = $container.ResourceGroupName
    $status= ((get-azcontainerGroup -ResourceGroupName $ENV:rsg_scraping -name $container.name).property |convertfrom-json).instanceview.state
    if ($status -ne "Running" ) {
        # Deñete the Azure Container Instances
        Remove-AzContainerGroup -ResourceGroupName $resourceGroupName -Name $aciinstance
    }
}
