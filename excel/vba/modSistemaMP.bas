Attribute VB_Name = "modSistemaMP"
'==============================================================================
' modSistemaMP - conexión del Excel con SistemaMP (Supabase).
'
' Cada persona entra con SU usuario de SistemaMP: el Excel ve y puede hacer lo
' mismo que esa persona en el programa (los permisos los aplica la base de datos).
' La contraseña NO se guarda: solo se usa para pedir un "token" de sesión, que
' dura aprox. 1 hora y se borra al cerrar el libro. El token para renovarla queda solo
' en memoria (nunca en una celda): si Excel se reinicia, hay que "Conectar" otra vez.
'
' Necesita (las crea la plantilla, hoja "Conexión"), celdas con nombre:
'   SB_URL, SB_KEY, SB_EMAIL, SB_TOKEN, SB_EXPIRA, SB_ULTIMA, SB_ESTADO
' Solo Excel de escritorio para Windows (usa MSXML2).
'==============================================================================
Option Explicit

Private Const MARGEN_SEG As Long = 120   ' renueva el token si le quedan menos de 2 minutos
Private mRefresh As String               ' token de renovación: solo en memoria

'--- Botón "Conectar": pide la contraseña, inicia sesión y actualiza todo -----
Public Sub Conectar()
    Dim email As String, clave As String
    email = Trim$(CStr(Rango("SB_EMAIL").Value))
    If email = "" Then
        email = InputBox("Correo con el que entras a SistemaMP:", "Conectar a SistemaMP")
        If email = "" Then Exit Sub
        Rango("SB_EMAIL").Value = email
    End If
    clave = PedirClave(email)
    If clave = "" Then Exit Sub

    Dim cuerpo As String
    cuerpo = "{""email"":""" & JsonEscapar(email) & """,""password"":""" & JsonEscapar(clave) & """}"
    clave = ""   ' no dejarla en memoria más de lo necesario

    Dim resp As String, estado As Long
    resp = PostAuth("password", cuerpo, estado)
    If estado <> 200 Then
        Rango("SB_ESTADO").Value = "No conectado"
        MsgBox "No se pudo iniciar sesión (código " & estado & ")." & vbCrLf & _
               "Revisa el correo y la contraseña (son los mismos de SistemaMP)." & vbCrLf & vbCrLf & _
               Left$(resp, 300), vbExclamation, "SistemaMP"
        Exit Sub
    End If
    GuardarSesion resp
    Actualizar
End Sub

'--- Botón "Actualizar": trae los datos nuevos de SistemaMP --------------------
Public Sub Actualizar()
    If Not SesionVigente() Then
        If Not Renovar() Then
            MsgBox "La sesión no está activa. Presiona "Conectar".", vbInformation, "SistemaMP"
            Exit Sub
        End If
    End If

    Dim c As WorkbookConnection
    Application.StatusBar = "SistemaMP: actualizando datos..."
    On Error Resume Next
    For Each c In ThisWorkbook.Connections   ' que espere a terminar cada consulta (no en segundo plano)
        c.OLEDBConnection.BackgroundQuery = False
    Next c
    On Error GoTo FALLO
    ThisWorkbook.RefreshAll
    Application.CalculateUntilAsyncQueriesDone
    Rango("SB_ULTIMA").Value = Now
    Rango("SB_ESTADO").Value = "Conectado"
    Application.StatusBar = False
    Exit Sub
FALLO:
    Application.StatusBar = False
    MsgBox "Error al actualizar: " & Err.Description, vbExclamation, "SistemaMP"
End Sub

'--- Botón "Desconectar": borra el token (también se llama al cerrar el libro) -
Public Sub Desconectar()
    On Error Resume Next
    mRefresh = ""
    Rango("SB_TOKEN").Value = ""
    Rango("SB_EXPIRA").Value = ""
    Rango("SB_ESTADO").Value = "No conectado"
End Sub

'==============================================================================
' Internas
'==============================================================================
Private Function Rango(nombre As String) As Range
    Set Rango = ThisWorkbook.Names(nombre).RefersToRange
End Function

Private Function PedirClave(email As String) As String
    ' Si existe el formulario frmLogin (campo con asteriscos), se usa; si no, InputBox.
    On Error GoTo SIN_FORM
    Dim f As Object
    Set f = VBA.UserForms.Add("frmLogin")
    f.txtEmail.Value = email
    f.Show
    If f.Aceptado Then PedirClave = f.txtClave.Value
    Unload f
    Exit Function
SIN_FORM:
    PedirClave = InputBox("Contraseña de SistemaMP para " & email & ":" & vbCrLf & _
                          "(Aviso: este cuadro muestra lo que escribes. Para ocultarla, agrega el formulario frmLogin.)", _
                          "Conectar a SistemaMP")
End Function

Private Function SesionVigente() As Boolean
    If CStr(Rango("SB_TOKEN").Value) = "" Then Exit Function
    If Not IsDate(Rango("SB_EXPIRA").Value) Then Exit Function
    SesionVigente = (DateDiff("s", Now, CDate(Rango("SB_EXPIRA").Value)) > MARGEN_SEG)
End Function

Private Function Renovar() As Boolean
    Dim rt As String, resp As String, estado As Long
    rt = mRefresh
    If rt = "" Then Exit Function
    resp = PostAuth("refresh_token", "{""refresh_token"":""" & JsonEscapar(rt) & """}", estado)
    If estado = 200 Then
        GuardarSesion resp
        Renovar = True
    Else
        Desconectar
    End If
End Function

Private Sub GuardarSesion(resp As String)
    Dim seg As Double
    Rango("SB_TOKEN").Value = JsonValor(resp, "access_token")
    mRefresh = JsonValor(resp, "refresh_token")
    seg = Val(JsonValor(resp, "expires_in"))
    If seg <= 0 Then seg = 3600
    Rango("SB_EXPIRA").Value = DateAdd("s", seg, Now)
    Rango("SB_ESTADO").Value = "Conectado"
End Sub

Private Function PostAuth(grant As String, cuerpo As String, ByRef estado As Long) As String
    Dim http As Object, url As String
    url = CStr(Rango("SB_URL").Value)
    If Right$(url, 1) <> "/" Then url = url & "/"
    Set http = CreateObject("MSXML2.XMLHTTP.6.0")
    On Error GoTo SIN_RED
    http.Open "POST", url & "auth/v1/token?grant_type=" & grant, False
    http.setRequestHeader "apikey", CStr(Rango("SB_KEY").Value)
    http.setRequestHeader "Content-Type", "application/json"
    http.send cuerpo
    estado = http.Status
    PostAuth = http.responseText
    Exit Function
SIN_RED:
    estado = 0
    PostAuth = "Sin conexión con el servidor: " & Err.Description
End Function

' Extrae el valor de una clave de primer nivel de un JSON simple (texto o número).
Private Function JsonValor(json As String, clave As String) As String
    Dim p As Long, i As Long, ch As String, s As String
    p = InStr(1, json, """" & clave & """:", vbBinaryCompare)
    If p = 0 Then Exit Function
    p = p + Len(clave) + 3
    Do While Mid$(json, p, 1) = " ": p = p + 1: Loop
    If Mid$(json, p, 1) = """" Then
        i = p + 1
        Do While i <= Len(json)
            ch = Mid$(json, i, 1)
            If ch = "\" Then
                s = s & Mid$(json, i + 1, 1): i = i + 2
            ElseIf ch = """" Then
                Exit Do
            Else
                s = s & ch: i = i + 1
            End If
        Loop
        JsonValor = s
    Else
        i = p
        Do While i <= Len(json) And InStr(",}] " & vbCr & vbLf, Mid$(json, i, 1)) = 0
            i = i + 1
        Loop
        JsonValor = Mid$(json, p, i - p)
    End If
End Function

Private Function JsonEscapar(t As String) As String
    t = Replace(t, "\", "\\")
    t = Replace(t, """", "\""")
    t = Replace(t, vbCr, "\r")
    t = Replace(t, vbLf, "\n")
    t = Replace(t, vbTab, "\t")
    JsonEscapar = t
End Function
