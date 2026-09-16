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

  -Tool パラメータで、起動する投入ツールを明示的に選ぶ(既定は初回投入で、
  これまでの挙動と変わらない)。初回投入(InitialImport)・追加データ投入
  (DetailExtension)・Phase D差分修正(PhaseDRemediation)は別物であり、
  意図せず混同して実行しないよう、必ずいずれか1つを明示的に選択させる設計にしている。
    - InitialImport     : pg-real-import.mjs(空テーブル前提のINSERT専用、初回投入)
    - DetailExtension   : pg-detail-extension-import.mjs(既存行への追加列UPDATEのみ、
      efhub_card_id/ai_styles/appearance/efhub_conflicts/boosters/link_up_plays。実行・COMMIT済み)
    - PhaseDRemediation : pg-phase-d-remediation-import.mjs(既存行への追加列UPDATEのみ、
      world_player_cards/managers.name_sort_key、player_card_analysis.efhub_name_en。
      Phase Dのシャドー比較で確認された2件の差分を修正する)

  -CaCertPath は必須。Supabase Session poolerの証明書チェーンがNode既定のCAストアに
  含まれない環境があり、指定が無いと"self-signed certificate in certificate chain"で
  実接続に失敗するため、指定が無ければ接続文字列・パスワードの入力を求める前に中止する
  (InitialImport/DetailExtensionいずれのツールでも同じ条件を適用する)。

.NOTES
  このスクリプトを Start-Transcript 実行中に使わないこと(入力内容がログへ残る恐れがある)。
#>

[CmdletBinding()]
param(
    # Supabase公式のCA証明書ファイルへのローカルパス(必須)。証明書は公開情報であり秘密情報ではないため、
    # 通常のパラメータとして受け取ってよい(コマンド履歴に残っても問題ない)。
    # 省略、または指定されたファイルが存在しない場合は、実接続前(接続文字列・パスワードの
    # 入力より前)に中止する("self-signed certificate in certificate chain"での接続失敗を防ぐため)。
    [string]$CaCertPath,

    # どちらの投入ツールを起動するか。既定は初回投入(これまでの挙動と同じ)。
    # 追加データ投入を行うときは -Tool DetailExtension、Phase D差分修正を行うときは
    # -Tool PhaseDRemediation を、それぞれ明示的に指定すること。
    [ValidateSet("InitialImport", "DetailExtension", "PhaseDRemediation")]
    [string]$Tool = "InitialImport",

    # 接続方式。現時点ではSession poolerのみ許可(Direct connection/Transaction poolerは
    # 接続前に常に拒否される)。将来的に他方式を安全に扱えるようになるまで、値は1つだけ。
    [ValidateSet("SessionPooler")]
    [string]$ConnectionMode = "SessionPooler"
)

$ErrorActionPreference = "Stop"

$TargetLabel = "efootball-team-ai-dev (Preview/Development)"
$TemplateEnvName = "MIGRATION_PG_CONNECTION_TEMPLATE"
$PasswordEnvName = "MIGRATION_PG_PASSWORD"
$TargetLabelEnvName = "MIGRATION_TARGET_LABEL"
$CaCertPathEnvName = "MIGRATION_PG_CA_CERT_PATH"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($Tool -eq "DetailExtension") {
    $ImportToolPath = Join-Path $ScriptDir "pg-detail-extension-import.mjs"
    $ToolDescription = "追加データ投入(既存行への追加列UPDATEのみ。新しい行のINSERT/DELETEは行わない)"
} elseif ($Tool -eq "PhaseDRemediation") {
    $ImportToolPath = Join-Path $ScriptDir "pg-phase-d-remediation-import.mjs"
    $ToolDescription = "Phase D差分修正(name_sort_key/efhub_name_en列の追加UPDATEのみ。新しい行のINSERT/DELETEは行わない)"
} else {
    $ImportToolPath = Join-Path $ScriptDir "pg-real-import.mjs"
    $ToolDescription = "初回投入(空テーブル前提のINSERT専用)"
}
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
    Write-Host "実行するツール: $ToolDescription" -ForegroundColor Cyan
    Write-Host "  ($ImportToolPath)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "接続方式(-ConnectionMode): $ConnectionMode" -ForegroundColor Cyan
    Write-Host "接続文字列: Supabase Dashboard の Connect 画面を開き、方式の一覧から"
    Write-Host "  必ず「Session pooler」を選んでからコピーしてください(SSL必須、ポート5432)。" -ForegroundColor Yellow
    Write-Host "  「Direct connection」や「Transaction pooler」のタブに表示される文字列は" -ForegroundColor Yellow
    Write-Host "  接続前に自動で拒否されます(誤って別タブをコピーした場合によくある失敗です)。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "接続文字列テンプレートとDBパスワードは、別々に・非表示で入力していただきます。"
    Write-Host "[YOUR-PASSWORD] というプレースホルダーは、あなたが手作業で編集する必要はありません。"
    Write-Host "このツールが安全に置換します。"
    Write-Host ""
    Write-Host "入力内容は画面に表示されず、コマンド履歴にも記録されません。"
    Write-Host "処理の終了後(成功・失敗・中断いずれでも)、環境変数から自動的に削除されます。"
    Write-Host ""

    # CA証明書は実接続の必須項目(initial-import/detail-extensionいずれのツールでも同じ条件)。
    # "self-signed certificate in certificate chain" での接続失敗を未然に防ぐため、
    # 接続文字列やパスワードの入力を求める前に、ここで先に必須チェックする。
    if ([string]::IsNullOrWhiteSpace($CaCertPath)) {
        Write-Host "-CaCertPath が指定されていません。実接続にはCA証明書の指定が必須です。" -ForegroundColor Red
        Write-Host "例: -CaCertPath .\data\tls\prod-ca-2021.crt" -ForegroundColor Red
        return
    }
    if (-not (Test-Path $CaCertPath)) {
        Write-Host "指定されたCA証明書ファイルが見つかりません: $CaCertPath" -ForegroundColor Red
        return
    }

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

    # -CaCertPathの必須チェック・実在チェックは、この関数の冒頭で既に完了している。
    $env:MIGRATION_PG_CA_CERT_PATH = (Resolve-Path $CaCertPath).Path
    Write-Host ""
    Write-Host "CA証明書を使用します(パス: $CaCertPath、内容は表示しません)。" -ForegroundColor Cyan

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
