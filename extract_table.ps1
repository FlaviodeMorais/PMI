<#
Extrai uma tabela de composicao quimica de um arquivo de texto gerado por
"pdftotext -layout", detectando dinamicamente as posicoes de coluna a partir
do cabecalho de cada pagina (Standard Designation | Grade... | Steel Number |
UNS Number | C | Mn | Si | P | S | Cr | Ni | Mo | [extras] | Others).
#>
param(
    [Parameter(Mandatory=$true)][string]$InputFile,
    [Parameter(Mandatory=$true)][string]$OutputCsv,
    [Parameter(Mandatory=$true)][string]$SectionLabel
)

$lines = Get-Content -Path $InputFile -Encoding UTF8

# Ordem esperada dos elementos quimicos centrais (sempre presentes nesta familia de tabelas)
$coreElements = @('C','Mn','Si','P','S','Cr','Ni','Mo')

$rows = New-Object System.Collections.Generic.List[object]

$columnStarts = $null      # hashtable ordenado: nome -> posicao inicial (0-based)
$columnOrder  = $null       # array ordenado dos nomes de coluna
$prevLine = ''
$lastDesignation = ''

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]

    if ($line -match '^=====PAGE \d+=====') { $prevLine=''; continue }
    if ($line -match '^\s*$') { $prevLine=$line; continue }
    if ($line -match '^\s*\d\.\d') { $prevLine=$line; continue }            # titulo de secao "2.1 ..."
    if ($line -match 'Handbook of Comparative World Steel Standards') { $prevLine=$line; continue }
    if ($line -match '^\s*Standard\s') { $prevLine=$line; continue }       # header linha 1

    # Linha de cabecalho de colunas: contem "Number" (1 ou 2x) seguido dos elementos e termina com "Others"
    if ($line -match 'Number.*\bC\b.*\bMn\b.*\bOthers\s*$') {
        $columnStarts = [ordered]@{}

        # posicao da palavra "Grade" na linha anterior define inicio da coluna Grade
        $gradeMatch = [regex]::Match($prevLine, '\bGrade\b')
        $gradeStart = if ($gradeMatch.Success) { $gradeMatch.Index } else { 25 }
        $columnStarts['Designation'] = 0
        $columnStarts['Grade'] = $gradeStart

        # "Number" pode aparecer 1x (so Steel Number) ou 2x (Steel Number + UNS Number)
        $numberMatches = [regex]::Matches($line, '\bNumber\b')
        if ($numberMatches.Count -ge 2) {
            $columnStarts['SteelNumber'] = $numberMatches[0].Index
            $columnStarts['UNSNumber']   = $numberMatches[1].Index
        } elseif ($numberMatches.Count -eq 1) {
            $columnStarts['SteelNumber'] = $numberMatches[0].Index
            $columnStarts['UNSNumber']   = $numberMatches[0].Index
        } else {
            $columnStarts['SteelNumber'] = $gradeStart + 10
            $columnStarts['UNSNumber']   = $gradeStart + 17
        }

        # elementos quimicos + extras + Others: todos os tokens alfabeticos curtos apos "Number"/UNS
        $searchStart = [Math]::Max($columnStarts['SteelNumber'], $columnStarts['UNSNumber']) + 1
        $tail = $line.Substring($searchStart)
        $tokenMatches = [regex]::Matches($tail, '\b[A-Za-z][A-Za-z]?\b')
        foreach ($m in $tokenMatches) {
            $name = $m.Value
            $pos  = $searchStart + $m.Index
            if (-not $columnStarts.Contains($name)) {
                $columnStarts[$name] = $pos
            }
        }

        $columnOrder = @($columnStarts.Keys)
        $prevLine = $line
        continue
    }

    if ($columnStarts -eq $null) { $prevLine = $line; continue }  # ainda nao achamos cabecalho

    # Extrai campos pelas posicoes de coluna detectadas
    $fields = [ordered]@{}
    for ($c = 0; $c -lt $columnOrder.Count; $c++) {
        $name = $columnOrder[$c]
        $start = $columnStarts[$name]
        if ($start -ge $line.Length) { $fields[$name] = ''; continue }
        $end = if ($c -lt $columnOrder.Count - 1) { $columnStarts[$columnOrder[$c+1]] } else { $line.Length }
        $end = [Math]::Min($end, $line.Length)
        $len = [Math]::Max(0, $end - $start)
        $fields[$name] = ($line.Substring($start, $len)).Trim()
    }

    # ignora linhas totalmente vazias (sem nenhum valor)
    $hasContent = $false
    foreach ($v in $fields.Values) { if ($v -ne '') { $hasContent = $true; break } }
    if (-not $hasContent) { $prevLine = $line; continue }

    if ($fields['Designation'] -ne '') {
        $lastDesignation = $fields['Designation']
    } else {
        $fields['Designation'] = $lastDesignation
    }

    $obj = [ordered]@{ Section = $SectionLabel }
    foreach ($k in $fields.Keys) { $obj[$k] = $fields[$k] }
    $rows.Add([pscustomobject]$obj)

    $prevLine = $line
}

$rows | Export-Csv -Path $OutputCsv -NoTypeInformation -Encoding UTF8
Write-Host "Linhas extraidas: $($rows.Count) -> $OutputCsv"
