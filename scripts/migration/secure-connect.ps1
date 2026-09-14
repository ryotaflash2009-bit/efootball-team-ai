<#
.SYNOPSIS
  reference_data 実データ投入用の、PostgreSQL接続情報を安全に受け取るための専用ラッパー。

.DESCRIPTION
  接続文字列テンプレート([YOUR-PASSWORD]プレースホルダーを含む)とDBパスワードを
  別々の非表示入力として受け取り、ユーザー自身にプレースホルダーを手作業編集させない。
  置換・URLエンコード・形式検証(Session poolerのみ許可)はすべてNode側の純関数
  (src/lib/reference-data/connection-string-builder.ts)が行い、値そのものは
  画面・ログ・ファイル・Gitへ一切出力しない。

  接続準備の検証(--validate-only)と実際の接続・投入(--execute)を、
  それぞれ独立したユーザー確認(2段階のyes入力)で分離する。
  入力直後に自動で投入が始まることはない。

.NOTES
  このスクリプトを Start-Transcript 実行中に使わないこと(入力内容がログへ残る恐れがある)。
#>

[CmdletBinding()]
param(
    # Supabase公式のCA証明書ファイルへのローカルパス(任意)。証明書は公開情報であり秘密情報ではないため、
    # 通常のパラメータとして受け取ってよい(コマンド履歴に残っても問題ない)。
    # 省略した場合はNode既定のCAストアで検証する(Session poolerの証明書チェーンが
    # そこに含まれない場合は "self-signed certificate in certificate chain" で失敗する)。
    [string]$CaCertPath
)

$ErrorActionPreference = "Stop"

$TargetLabel = "efootball-team-ai-dev (Preview/Development)"
$TemplateEnvName = "MIGRATION_PG_CONNECTION_TEMPLATE"
$PasswordEnvName = "MIGRATION_PG_PASSWORD"
$TargetLabelEnvName = "MIGRATION_TARGET_LABEL"
$CaCertPathEnvName = "MIGRATION_PG_CA_CERT_PATH"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ImportToolPath = Join-Path $ScriptDir "pg-real-import.mjs"
$RepoRoot = Join-Path $ScriptDir "..\.."

$plainTemplate = $null
$plainPassword = $null
$templatePtr = [IntPtr]::Zero
$passwordPtr = [IntPtr]::Zero

function Clear-MigrationSecrets {
    if (Test-Path "Env:\$TemplateEnvName") { Remove-Item "Env:\$TemplateEnvName" -ErrorAction SilentlyContinue }
    if (Test-Path "Env:\$PasswordEnvName") { Remove-Item "Env:\$PasswordEnvName" -ErrorAction SilentlyContinue }
    if (Test-Path "Env:\$TargetLabelEnvName") { Remove-Item "Env:\$TargetLabelEnvName" -ErrorAction SilentlyContinue }
    if (Test-Path "Env:\$CaCertPathEnvName") { Remove-Item "Env:\$CaCertPathEnvName" -ErrorAction SilentlyContinue }
    if ($script:templatePtr -ne [IntPtr]::Zero) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($script:templatePtr)
        $script:templatePtr = [IntPtr]::Zero
    }
    if ($script:passwordPtr -ne [IntPtr]::Zero) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($script:passwordPtr)
        $script:passwordPtr = [IntPtr]::Zero
    }
    $script:plainTemplate = $null
    $script:plainPassword = $null
    [System.GC]::Collect()
}

trap {
    Write-Host ""
    Write-Host "予期しないエラーが発生したため、後片付けを実行します。" -ForegroundColor Yellow
    Clear-MigrationSecrets
    break
}

try {
    Write-Host "======================================================"
    Write-Host " reference_data 実データ投入 — 接続情報の安全な入力"
    Write-Host "======================================================"
    Write-Host ""
    Write-Host "対象プロジェクト: $TargetLabel" -ForegroundColor Cyan
    Write-Host "これはPreview/開発専用プロジェクトです。Production用プロジェクトではありません。" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "接続方式: Supabase Dashboard の Connect 画面から取得した"
    Write-Host "  Session pooler の接続文字列を使用してください(SSL必須)。"
    Write-Host "  Direct connection は、Windows側のIPv6到達性が確認できる場合のみ代替候補です。"
    Write-Host "  Transaction pooler は今回使用しないでください。"
    Write-Host ""
    Write-Host "接続文字列テンプレートとDBパスワードは、別々に・非表示で入力していただきます。"
    Write-Host "[YOUR-PASSWORD] というプレースホルダーは、あなたが手作業で編集する必要はありません。"
    Write-Host "このツールが安全に置換します。"
    Write-Host ""
    Write-Host "入力内容は画面に表示されず、コマンド履歴にも記録されません。"
    Write-Host "処理の終了後(成功・失敗・中断いずれでも)、環境変数から自動的に削除されます。"
    Write-Host ""

    $confirm = Read-Host "上記を確認し、続行しますか? (yes と入力してください)"
    if ($confirm -ne "yes") {
        Write-Host "続行しませんでした。何も変更していません。"
        return
    }

    Write-Host ""
    Write-Host "1つ目の入力: 接続文字列テンプレート" -ForegroundColor Cyan
    Write-Host "Supabase Dashboard の Connect 画面からコピーした、Session pooler の接続文字列を"
    Write-Host "そのまま貼り付けてください([YOUR-PASSWORD]はそのままで構いません)。"
    $secureTemplate = Read-Host -Prompt "接続文字列テンプレート" -AsSecureString
    if ($secureTemplate.Length -eq 0) {
        Write-Host "何も入力されませんでした。中止します。"
        return
    }
    $templatePtr = [System.Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($secureTemplate)
    $plainTemplate = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($templatePtr)

    Write-Host ""
    Write-Host "2つ目の入力: DBパスワード" -ForegroundColor Cyan
    Write-Host "Supabaseのデータベースパスワードを、URLエンコード等の加工をせず、そのまま入力してください。"
    $securePassword = Read-Host -Prompt "DBパスワード" -AsSecureString
    if ($securePassword.Length -eq 0) {
        Write-Host "何も入力されませんでした。中止します。"
        return
    }
    $passwordPtr = [System.Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($securePassword)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($passwordPtr)

    if ([string]::IsNullOrWhiteSpace($plainTemplate) -or [string]::IsNullOrWhiteSpace($plainPassword)) {
        Write-Host "テンプレートまたはパスワードが空でした。中止します。"
        return
    }

    $env:MIGRATION_PG_CONNECTION_TEMPLATE = $plainTemplate
    $env:MIGRATION_PG_PASSWORD = $plainPassword
    $env:MIGRATION_TARGET_LABEL = $TargetLabel

    if ($CaCertPath) {
        if (-not (Test-Path $CaCertPath)) {
            Write-Host ""
            Write-Host "指定されたCA証明書ファイルが見つかりません: $CaCertPath" -ForegroundColor Yellow
            return
        }
        $env:MIGRATION_PG_CA_CERT_PATH = (Resolve-Path $CaCertPath).Path
        Write-Host ""
        Write-Host "CA証明書を使用します(パス: $CaCertPath、内容は表示しません)。" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "CA証明書が指定されていません。Node既定のCAストアで検証します。" -ForegroundColor Yellow
        Write-Host "Session poolerの証明書チェーンがそこに含まれない場合、接続時に" -ForegroundColor Yellow
        Write-Host "'self-signed certificate in certificate chain' で失敗します。その場合は" -ForegroundColor Yellow
        Write-Host "Supabase DashboardからCA証明書をダウンロードし、-CaCertPath で指定してください。" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "入力内容を検証します(この時点ではまだ実Supabaseへ接続しません)..."

    Push-Location $RepoRoot
    try {
        & node $ImportToolPath --validate-only
        $validateExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    if ($validateExitCode -ne 0) {
        Write-Host ""
        Write-Host "検証に失敗したため中止します(詳細は上記の出力を確認してください)。実接続は行っていません。" -ForegroundColor Yellow
        return
    }

    Write-Host ""
    Write-Host "検証に成功しました。接続文字列の内容自体はここでも表示しません。" -ForegroundColor Green
    Write-Host ""
    $finalConfirm = Read-Host "実際にSupabaseへ接続し、投入処理を開始しますか? (yes と入力してください)"
    if ($finalConfirm -ne "yes") {
        Write-Host "続行しませんでした。実接続・投入は行っていません。"
        return
    }

    Write-Host ""
    Write-Host "投入ツールを起動します(このプロセスにだけ接続情報を渡します)..."

    Push-Location $RepoRoot
    try {
        & node $ImportToolPath --execute
        $nodeExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    Write-Host ""
    if ($nodeExitCode -eq 0) {
        Write-Host "投入ツールはCOMMIT(成功)で終了しました。" -ForegroundColor Green
    } else {
        Write-Host "投入ツールはROLLBACKまたはエラーで終了しました(終了コード $nodeExitCode)。詳細は上記の出力を確認してください。" -ForegroundColor Yellow
    }
}
finally {
    Clear-MigrationSecrets
    Write-Host ""
    Write-Host "接続情報を環境変数・メモリから削除しました。"
}
