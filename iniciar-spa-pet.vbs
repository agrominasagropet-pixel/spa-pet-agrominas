Set WshShell = CreateObject("WScript.Shell")

If SiteRespondendo("http://localhost:3001") Then
    WshShell.Run "http://localhost:3001", 1, False
ElseIf SiteRespondendo("http://localhost:3000") Then
    WshShell.Run "http://localhost:3000", 1, False
Else
    WshShell.Run """C:\Projetos\agrominas\iniciar-spa-pet.bat""", 0, False
End If

Set WshShell = Nothing

Function SiteRespondendo(url)
    On Error Resume Next

    Set requisicao = CreateObject("WinHttp.WinHttpRequest.5.1")
    requisicao.SetTimeouts 300, 300, 500, 500
    requisicao.Open "GET", url, False
    requisicao.Send

    SiteRespondendo = (Err.Number = 0 And requisicao.Status >= 200 And requisicao.Status < 400)

    Err.Clear
    On Error GoTo 0
End Function