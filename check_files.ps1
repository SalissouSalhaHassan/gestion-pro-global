$cutOffDate = Get-Date "2026-06-10"
Get-ChildItem -Recurse -File | Where-Object { 
    $_.FullName -notmatch '\\(node_modules|\.next|\.git)\\' -and 
    $_.LastWriteTime -gt $cutOffDate 
} | ForEach-Object {
    [PSCustomObject]@{
        LastWriteTime = $_.LastWriteTime
        Path = $_.FullName
    }
} | Format-Table -AutoSize
