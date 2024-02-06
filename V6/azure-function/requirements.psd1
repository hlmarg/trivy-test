# This file enables modules to be automatically managed by the Functions service.
# See https://aka.ms/functionsmanageddependency for additional information.
#
@{
    # For latest supported version, go to 'https://www.powershellgallery.com/packages/Az'. 
    # To use the Az module in your function app, please uncomment the line below.
    # 'Az' = '9.*'
    'Az' = '9.*'
    'Az.KeyVault' = '4.*'
    'Az.Resources' = '6.*' 
    'Az.Storage' = '5.*'
    'Az.ContainerInstance' = '3.*'
    'Az.OperationalInsights' = '3.*'
}
