$headers = @{
    'Authorization' = 'Bearer rnd_2U5Gr0uazWyp0AcPmdFKjsHkyV0G'
    'Content-Type' = 'application/json'
}

$body = @{
    type = 'web_service'
    name = 'journal-club-standalone'
    ownerId = 'tea-d3klima4d50c73dd0vb0'
    repo = 'https://github.com/nayanlc19/journal-club-standalone'
    branch = 'master'
    autoDeploy = 'yes'
    serviceDetails = @{
        env = 'node'
        plan = 'starter'
        region = 'singapore'
        envSpecificDetails = @{
            buildCommand = 'npm install && npm run build'
            startCommand = 'npm run start'
        }
    }
} | ConvertTo-Json -Depth 5

Write-Host "Creating Render service..."
$response = Invoke-RestMethod -Uri 'https://api.render.com/v1/services' -Method Post -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10
