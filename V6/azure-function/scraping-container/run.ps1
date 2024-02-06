# Input bindings are passed in via param block.
param($QueueItem, $TriggerMetadata)

# Write out the queue message and insertion time to the information log.
Write-Host "PowerShell queue trigger function processed work item: $QueueItem"
Write-Host "Queue item insertion time: $($TriggerMetadata.InsertionTime)"

#connect to azure
$contextaz= Get-AzContext
if ($contextaz -ne $null){
    Write-Output "Disconnecting the current session"
    Disconnect-AzAccount
}
$secPassword = ConvertTo-SecureString $ENV:spn_clientSecret -AsPlainText -Force
$Credential = New-Object -TypeName System.Management.Automation.PSCredential -ArgumentList $ENV:spn_clientId, $secPassword
Connect-AzAccount -ServicePrincipal -TenantId $ENV:spn_tenantId -Credential $Credential
Select-AzSubscription -SubscriptionId df564b36-dc70-4793-bcbf-dd5b92cb43ff

# validater the Azure connection
$ErrorActionPreference= 'continue'
$validation=(Get-AzResourceGroup).ResourceGroupName | where {$_ -like "*scraping*"}
if ($null -eq $validation) {
    $attempts=3    
    $sleepInSeconds=5
    do
    {
        Disconnect-AzAccount
        sleep $sleepInSeconds
        Connect-AzAccount -ServicePrincipal -TenantId $ENV:spn_tenantId -Credential $Credential
        Write-Output "Remain attemts $attempts"
        $attempts--
        if ($attempts -gt 0) { sleep $sleepInSeconds }
    } until (($attempts -gt 0) -or ( $null -eq ((Get-AzResourceGroup -ErrorAction SilentlyContinue).ResourceGroupName | where {$_ -like "*scraping*"}) ))

    if ($attempts -eq 0) {
        write-output "Sending to the API the request to create a retry"
        #$messageBodyerror = $QueueItem | ConvertTo-Json -depth 3
        #$parsedMessageerror = ConvertFrom-Json $messageBodyerror
        #$acinameerror= ($parsedMessageerror.scraping.instanceName).Split("-")[-1]
        #$uri= "http://foobar.com/endpoint"
        #$params = @{
        #    "Container"="$acinameerror";
        #    "Error"="Error";
        #    "ErrorDetails"="The Azure Function App can login on Azure.";
        #}
        #Invoke-WebRequest -Uri $uri -Method POST -Body $params
        exit
    }
}

# Import the Azure.Storage.Queues PowerShell module
Import-Module Az.Storage -Force
Import-Module -name Az.ContainerInstance
Import-Module -name Az.OperationalInsights

#function to create the container.
Write-Output "Register the Function to validate the Azure connection"
function Get-AzureStatus {
    Param(
        [string] $command
    )
    $validation = (Get-AzResourceGroup -ErrorAction SilentlyContinue).ResourceGroupName
    if ($null -eq $validation) {
        $attempts=3    
        $sleepInSeconds=5
        do {
            try {
                # Attempt command
                $result = (Get-AzResourceGroup -ErrorAction stop).ResourceGroupName
                # If command is successful, break the loop
                if ($null -ne $result ) {
                     Invoke-Expression $command
                    break
                }
            }
            catch {
                Write-Output "Azure is not Connected. Attempting to connect $attempts..."
                Disconnect-AzAccount
                Start-Sleep -Seconds $sleepInSeconds
                Connect-AzAccount -ServicePrincipal -TenantId $ENV:spn_tenantId -Credential $Credential -ErrorAction SilentlyContinue
            }
            $attempts--
        } until ($attempts -le 0)
        
        if ($attempts -eq 0) {
            Write-Output "Failed after 3 attempts"
            write-output "Adding on the Queue for retry the Deploy"           
            $storageAccountName = $env:stgconnection.Split(";")[2].Split("=")[1]
            $storageAccountKey = $env:stgconnection.Split(";")[3].Split("Key=")[1]
            $queueName = $env.queue
            $messageContent = $messageBody 

            $context = New-AzStorageContext -StorageAccountName $storageAccountName -StorageAccountKey $storageAccountKey
            $queue = Get-AzStorageQueue -Name $queueName -Context $context
            $message = [Microsoft.Azure.Storage.Queue.CloudQueueMessage]::new($messageContent)
            $queue.CloudQueue.AddMessage($message)
            exit
        }else { Invoke-Expression $command }

    } else { Invoke-Expression $command }
}

Write-Output "Register the Function Run-scraping"
function run-scraping {
    Param(
      [string] $cpu,

      [String]$memory,

      [String]$context,

      [String]$aciinstance,

      [string]$location,

      [Parameter(Mandatory)]
      [ValidateNotNullOrEmpty()]
      [hashtable]$envVariables
    )

    if ($cpu -eq ""){
        $cpu = 1
    }
    if ($memory -eq ""){
        $memory = 2
    }
    if ($context -eq ""){
        $context = "dev"
    }
    if ($aciinstance -eq ""){
        $aciinstance = "scraping"+ (get-date -Format "dd-MM-yyyy--HH-mm-ss-ffff")
    }        
    if ($location -eq ""){
        $location = "westus"
        $vnetname = $env:vnet_west

    }
    if ($location -eq "west"){
        $location = "westus"
        $vnetname = $env:vnet_west
    }
    if ($location -eq "east"){
        $location = "eastus"
        $vnetname = $env:vnet_east
    }
    if ($location -eq "central"){
        $location = "northcentralus"
        $vnetname = $env:vnet_central
    }
 
    # Set variables
    $resourceGroupName = $env:rsg_scraping
    $resourceGroupNameshared = $env:rsg_shared 
    $lawname= $env:scriping_law
    $workspaceID= $env:workspace_id #Get-AzureStatus -command "(Get-AzOperationalInsightsWorkspace -Name $lawname -ResourceGroupName $resourceGroupName).CustomerId"
    $workspacekey= Get-AzureStatus -command "(Get-AzOperationalInsightsWorkspaceSharedKeys -ResourceGroupName $resourceGroupName -Name $lawname).PrimarySharedKey"
    $imagecontext= if ($context -eq "prod"){"/scraping:latest"}else{"/scraping-dev:latest"}
    $image = $env:scriping_acr_fqdn + $imagecontext
    $acrfqdn= $env:scriping_acr_fqdn
    $acrusername = Get-AzureStatus -command "(Get-AzContainerRegistryCredential -ResourceGroupName $resourceGroupName -Name $env:scriping_acr_name ).username"
    $acrpassword = Get-AzureStatus -command "(Get-AzContainerRegistryCredential -ResourceGroupName $resourceGroupName -Name $env:scriping_acr_name ).password"
    $vnetname = Get-AzureStatus -command '(Get-AzVirtualNetwork -ResourceGroupName $resourceGroupNameshared |where {$_.Location -eq $location}).Name'
    Write-Output "the vnet is $vnetname"
    $subnet = Get-AzureStatus -command 'Get-AzVirtualNetworkSubnetConfig -VirtualNetwork (Get-AzVirtualNetwork -ResourceGroupName $resourceGroupNameshared -Name $vnetname) | where {$_.name -like "*container*"}'
    $subnethash = @{
        id = $subnet.id
        name = $subnet.name
    }
    # Create the Azure Container Instances
    write-output "the container name is $aciinstance"
    $containervariables= foreach ($item in $envVariables.GetEnumerator()) {New-AzContainerInstanceEnvironmentVariableObject -Name $item.key -Value $item.Value}
    $acrcredentials = New-AzContainerGroupImageRegistryCredentialObject -Server $acrfqdn -Username $acrusername -Password (ConvertTo-SecureString $acrpassword -AsPlainText -Force)
    $container = New-AzContainerInstanceObject -Name $aciinstance -Image $image -RequestCpu $cpu -RequestMemoryInGB $memory -EnvironmentVariable  $containervariables
    $containergroup = New-AzContainerGroup -ResourceGroupName $resourceGroupName `
        -Name $aciinstance `
        -Location $location `
        -Container $container `
        -RestartPolicy "Never" `
        -SubnetId $subnethash `
        -ImageRegistryCredential $acrcredentials `
        -LogAnalyticWorkspaceId $workspaceID `
        -LogAnalyticWorkspaceKey $workspacekey
}

# Set the Azure Storage account and queue name
Write-Output "getting the Queue objects"
# Define the parameter for the container
$messageBody = $QueueItem | ConvertTo-Json -depth 3
$parsedMessage = ConvertFrom-Json $messageBody
$cpu = $parsedMessage.scraping.cpu
$mem = $parsedMessage.scraping.memoryGB
$aciname= $parsedMessage.scraping.instanceName
$location = $parsedMessage.scraping.location
Write-Output "The ACI Configureation is"
Write-Output "CPU: $cpu"
Write-Output "Memory: $mem"
Write-Output "Instance Name: $aciname"
Write-Output "Location: $location"
#Define the variables for the command
Write-Output "Defining the Environment Variables"
$envVariables = @{}
(ConvertFrom-Json $messageBody ).scraping.environmentVariables | Foreach { 
    if (![string]::IsNullOrWhiteSpace($_.Name) -and ![string]::IsNullOrWhiteSpace($_.Value)) {
        $envVariables+= @{$_.Name = $_.Value} 
    }
}
$envVariables

# Call the funtion to create the Container
if ( $null -eq $aciname ){
    run-scraping -cpu $cpu -memory $mem -envVariables $envVariables -context $parsedMessage.scraping.context -location $location
}
else{
    run-scraping -cpu $cpu -memory $mem -envVariables $envVariables -aciinstance $aciname -context $parsedMessage.scraping.context -location $location
}
#Validate and repot the status of the container
Start-Sleep -Seconds 5
$acistatus=get-azcontainerGroup -ResourceGroupName $env:rsg_scraping | Where-Object { $_.name -eq $aciname}
if ($null -eq $acistatus) {
    $storageAccountName = $env:stgconnection.Split(";")[2].Split("=")[1]
    $storageAccountKey = $env:stgconnection.Split(";")[3].Split("Key=")[1]
    $queueName = $env.queue
    $messageContent = $messageBody
    $context = New-AzStorageContext -StorageAccountName $storageAccountName -StorageAccountKey $storageAccountKey
    $queue = Get-AzStorageQueue -Name $queueName -Context $context
    $message = [Microsoft.Azure.Storage.Queue.CloudQueueMessage]::new($messageContent)
    $queue.CloudQueue.AddMessage($message)
    write-output "The container not created was $aciname"
}
