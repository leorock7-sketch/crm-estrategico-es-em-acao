# Cria (ou remove, com -Remover) a tarefa diaria de copias do CRM no Agendador de Tarefas (D-084).
# Diaria as 12:30, so com o usuario conectado (nenhuma senha guardada no agendador), executada assim
# que possivel se o horario for perdido, sem execucoes simultaneas e com limite de 30 minutos.
# Comando: npm run backup:agendar   |   Remover: npm run backup:agendar -- -Remover
param([switch]$Remover)

$nome = "CRM - copia diaria (desenvolvimento)"
if ($Remover) {
  Unregister-ScheduledTask -TaskName $nome -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output "[OK] Tarefa removida (se existia): $nome"
  exit 0
}

$repositorio = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script = Join-Path $PSScriptRoot "rotina-diaria.ps1"
$acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`"" -WorkingDirectory $repositorio
$gatilho = New-ScheduledTaskTrigger -Daily -At "12:30"
$configuracao = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$usuario = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$descricao = "Copia diaria criptografada do banco de desenvolvimento do CRM (dados ficticios), D-084. Remover: npm run backup:agendar -- -Remover"
Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $configuracao -Principal $usuario -Description $descricao -Force | Out-Null
$tarefa = Get-ScheduledTask -TaskName $nome
Write-Output "[OK] Tarefa criada: $nome | situacao: $($tarefa.State) | proxima execucao: $((Get-ScheduledTaskInfo -TaskName $nome).NextRunTime)"
