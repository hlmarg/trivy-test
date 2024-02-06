param (
[string]$ResourceGroupName,             #Resource Group For the Web or Function App
[string]$MSIResourceGroupName,          #Resource Group For the MSI
[string]$webappName,                    #Name of the Web App to add the new Setting.
[string]$FunctionappName,               #Name of the Function App to add the new Setting.
[string]$AppSettingtoAdd,               #Name of the setting to add on the web/Function App.
[string]$SecretKeyUri,                  #URL for the Secret on the KeyVault
[switch]$IsFunctionApp,                 #Switch to Update only a Funtion App.
[switch]$IsWebApp                       #Switch to Update only a Web App.
)

$ManageIdentity= (az identity list --resource-group $MSIResourceGroupName | ConvertFrom-Json).name

if($IsWebApp) {
    $webappNamevalues=az webapp config appsettings list --name $webappName --resource-group $ResourceGroupName |ConvertFrom-Json

    if($webappNamevalues.name -notcontains $AppSettingtoAdd) {

        $userAssignedIdentityResourceId=$(az identity show -g $MSIResourceGroupName -n $ManageIdentity --query id -o tsv)
        $appResourceId=$(az webapp show -g $ResourceGroupName -n $webappName --query id -o tsv)
        az rest --method PATCH --uri "${appResourceId}?api-version=2021-01-01" --body "{'properties':{'keyVaultReferenceIdentity':'${userAssignedIdentityResourceId}'}}"  -o none

        $NewappSeetingvalue= $AppSettingtoAdd+ "= @Microsoft.KeyVault(SecretUri=" + $SecretKeyUri +")"
        $appsetingstatus=az webapp config appsettings list --name $webappName -g $ResourceGroupName --query "[?name=='$AppSettingtoAdd']"
        if ($appsetingstatus){
            az webapp config appsettings delete --name $webappName --resource-group $ResourceGroupName --setting-names $AppSettingtoAdd -o none
        }
        az webapp config appsettings set --name $webappName --resource-group $ResourceGroupName --settings $NewappSeetingvalue -o none
        az webapp stop --name $webappName --resource-group $ResourceGroupName -o none
        az webapp start --name $webappName --resource-group $ResourceGroupName -o none

    }
}

if($IsFunctionApp) {

    #$FunctionApp=az functionapp list --resource-group $ResourceGroupName |ConvertFrom-Json
    $FunctionAppvalue= az  functionapp config appsettings list --name $FunctionappName  --resource-group $ResourceGroupName |ConvertFrom-Json
    $NewFuntionappSeetingvalue= $AppSettingtoAdd+ "= @Microsoft.KeyVault(SecretUri=" + $SecretKeyUri +")"
    $CurrentStringValue= ($FunctionAppvalue |where {$_.name -eq $AppSettingtoAdd}).value

    if (($FunctionAppvalue -notcontains $AppSettingtoAdd) -or ($CurrentStringValue -ne $NewFuntionappSeetingvalue)) {

        $userAssignedIdentityResourceId=$(az identity show -g $MSIResourceGroupName -n $ManageIdentity --query id -o tsv)
        $appResourceId=$(az webapp show -g $ResourceGroupName -n $FunctionappName  --query id -o tsv)
        az rest --method PATCH --uri "${appResourceId}?api-version=2021-01-01" --body "{'properties':{'keyVaultReferenceIdentity':'${userAssignedIdentityResourceId}'}}"  -o none

        $NewFuntionappSeetingvalue= $AppSettingtoAdd+ "= @Microsoft.KeyVault(SecretUri=" + $SecretKeyUri +")"
        $appsetingstatus=az functionapp config appsettings list --name $FunctionappName -g $ResourceGroupName --query "[?name=='$AppSettingtoAdd']"
        if ($appsetingstatus){
            az functionapp config appsettings delete --name $FunctionappName --resource-group $ResourceGroupName --setting-names $AppSettingtoAdd -o none
        }
        az functionapp config appsettings set --name $FunctionappName --resource-group $ResourceGroupName --settings $NewFuntionappSeetingvalue  -o none

        az functionapp stop --name $FunctionappName --resource-group $ResourceGroupName  -o none
        az functionapp start --name $FunctionappName --resource-group $ResourceGroupName   -o none

    }
}
