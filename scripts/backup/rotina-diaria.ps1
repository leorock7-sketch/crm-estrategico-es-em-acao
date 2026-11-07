# Rotina diaria de copias do CRM (D-084), chamada pelo Agendador de Tarefas do Windows.
# Somente o banco de desenvolvimento, com dados ficticios.
# Avisos visiveis no Windows, sem arquivos (a Area de Trabalho pode estar no OneDrive, que impede
# processos do Agendador de regravar arquivos ja sincronizados):
# - falha: notificacao do Windows (fica na central de notificacoes) e mensagem na tela;
# - pendencia (ensaio mensal vencido, chave nao conferida, monitor): so a notificacao;
# - execucao sem pendencias: retira a notificacao anterior.
# O registro detalhado fica em registro-rotina.log, na pasta local das copias.

$ErrorActionPreference = "Continue"
$repositorio = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repositorio

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = Join-Path $env:ProgramFiles "nodejs\node.exe" }

# Argumentos extras (ex.: --forcar) seguem para a rotina; a tarefa agendada nao passa nenhum.
$saida = & $node "node_modules\tsx\dist\cli.mjs" "scripts\backup\rotina.ts" @args 2>&1 | Out-String
$codigo = $LASTEXITCODE
if ($null -eq $codigo) { $codigo = 1 }
$resultado = ($saida -split "`r?`n" | Where-Object { $_ -like "RESULTADO|*" } | Select-Object -Last 1)
if (-not $resultado) { $resultado = "RESULTADO|falha|rotina-nao-concluiu" }
$partes = $resultado -split "\|"

# Identificador do Windows PowerShell para notificacoes; a mesma marca faz cada aviso substituir o anterior.
$idAplicativo = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"
$marca = "crm-copia-diaria"
$grupo = "crm"

function Mostrar-Notificacao([string]$titulo, [string]$texto) {
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $modelo = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $linhas = $modelo.GetElementsByTagName("text")
    $linhas.Item(0).AppendChild($modelo.CreateTextNode($titulo)) | Out-Null
    $linhas.Item(1).AppendChild($modelo.CreateTextNode($texto)) | Out-Null
    $notificacao = New-Object Windows.UI.Notifications.ToastNotification $modelo
    $notificacao.Tag = $marca
    $notificacao.Group = $grupo
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($idAplicativo).Show($notificacao)
  } catch {
    # Sem notificacao disponivel; em falha, a mensagem na tela ainda aparece.
  }
}

if ($codigo -eq 0) {
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.UI.Notifications.ToastNotificationManager]::History.Remove($marca, $grupo, $idAplicativo)
  } catch {
    # Nada a retirar.
  }
} elseif ($codigo -eq 2) {
  Mostrar-Notificacao "CRM - copia diaria: pendencia" "Copias conferidas. Pendencia: $($partes[2]). Veja docs/OPERACAO.md, secao 5."
} else {
  Mostrar-Notificacao "CRM - copia diaria: FALHA" "As copias anteriores foram preservadas. Motivo: $($partes[2]). Detalhes em registro-rotina.log, na pasta local das copias."
  (New-Object -ComObject WScript.Shell).Popup("A copia diaria do CRM falhou. As copias anteriores foram preservadas. Motivo: $($partes[2]). Detalhes em registro-rotina.log, na pasta local das copias.", 300, "CRM - copia diaria", 48) | Out-Null
}
exit $codigo
