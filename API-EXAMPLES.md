# Exemplos de Uso da API - FlowCloser-EVOLUTION

Este documento mostra exemplos práticos de como chamar a API do FlowCloser-EVOLUTION.

## Configuração Inicial

### 1. Base URL (Railway)

A API está hospedada no Railway. Você pode obter a URL do seu projeto Railway:

```
https://flowcloser-agent-production.up.railway.app
```

Ou use a URL customizada configurada no Railway:

```
https://seu-dominio-customizado.com
```

**Obtendo a URL do Railway:**

1. Acesse seu projeto no [Railway](https://railway.app)
2. Vá em **Settings** > **Domains**
3. Use a URL pública fornecida (ex: `flowcloser-agent-production.up.railway.app`)
4. Ou configure um domínio customizado

### 2. Autenticação

Todas as requisições (exceto `/` e `/metrics`) precisam do header:

```http
apikey: sua-chave-secreta-aqui
```

Configure a chave no Railway:

1. Acesse seu projeto no Railway
2. Vá em **Variables**
3. Adicione: `AUTHENTICATION_API_KEY=sua-chave-secreta-aqui`

## Exemplos com cURL

### 1. Verificar Status da API

```bash
curl https://flowcloser-agent-production.up.railway.app/
```

### 2. Criar Instância WhatsApp

```bash
curl -X POST https://flowcloser-agent-production.up.railway.app/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: sua-chave-secreta-aqui" \
  -d '{
    "instanceName": "minha-instancia",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

### 3. Listar Todas as Instâncias

```bash
curl https://flowcloser-agent-production.up.railway.app/instance/fetchInstances \
  -H "apikey: sua-chave-secreta-aqui"
```

### 4. Enviar Mensagem de Texto

```bash
curl -X POST https://flowcloser-agent-production.up.railway.app/message/sendText/minha-instancia \
  -H "Content-Type: application/json" \
  -H "apikey: sua-chave-secreta-aqui" \
  -d '{
    "number": "5511999999999",
    "text": "Olá! Esta é uma mensagem de teste."
  }'
```

### 5. Enviar Imagem

```bash
curl -X POST https://flowcloser-agent-production.up.railway.app/message/sendMedia/minha-instancia \
  -H "Content-Type: application/json" \
  -H "apikey: sua-chave-secreta-aqui" \
  -d '{
    "number": "5511999999999",
    "mediatype": "image",
    "media": "data:image/png;base64,iVBORw0KG...",
    "caption": "Legenda da imagem"
  }'
```

## Exemplos com JavaScript/Node.js

### 1. Configuração Base

```javascript
// Substitua pela URL do seu projeto Railway
const API_BASE_URL = 'https://flowcloser-agent-production.up.railway.app';
const API_KEY = 'sua-chave-secreta-aqui';

const headers = {
  'Content-Type': 'application/json',
  'apikey': API_KEY
};
```

### 2. Criar Instância

```javascript
async function criarInstancia(nomeInstancia) {
  const response = await fetch(`${API_BASE_URL}/instance/create`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      instanceName: nomeInstancia,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS'
    })
  });
  
  return await response.json();
}

// Uso
const resultado = await criarInstancia('minha-instancia');
console.log('QR Code:', resultado.qrcode.base64);
```

### 3. Listar Instâncias

```javascript
async function listarInstancias() {
  const response = await fetch(`${API_BASE_URL}/instance/fetchInstances`, {
    method: 'GET',
    headers: {
      'apikey': API_KEY
    }
  });
  
  return await response.json();
}
```

### 4. Enviar Mensagem

```javascript
async function enviarMensagem(instancia, numero, texto) {
  const response = await fetch(`${API_BASE_URL}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      number: numero,
      text: texto
    })
  });
  
  return await response.json();
}

// Uso
await enviarMensagem('minha-instancia', '5511999999999', 'Olá!');
```

### 5. Enviar Mídia

```javascript
async function enviarImagem(instancia, numero, imagemBase64, legenda) {
  const response = await fetch(`${API_BASE_URL}/message/sendMedia/${instancia}`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      number: numero,
      mediatype: 'image',
      media: `data:image/png;base64,${imagemBase64}`,
      caption: legenda
    })
  });
  
  return await response.json();
}
```

## Exemplos com Python

### 1. Configuração Base

```python
import requests

# Substitua pela URL do seu projeto Railway
API_BASE_URL = 'https://flowcloser-agent-production.up.railway.app'
API_KEY = 'sua-chave-secreta-aqui'

headers = {
    'Content-Type': 'application/json',
    'apikey': API_KEY
}
```

### 2. Criar Instância

```python
def criar_instancia(nome_instancia):
    url = f'{API_BASE_URL}/instance/create'
    data = {
        'instanceName': nome_instancia,
        'qrcode': True,
        'integration': 'WHATSAPP-BAILEYS'
    }
    response = requests.post(url, json=data, headers=headers)
    return response.json()

# Uso
resultado = criar_instancia('minha-instancia')
print('QR Code:', resultado['qrcode']['base64'])
```

### 3. Enviar Mensagem

```python
def enviar_mensagem(instancia, numero, texto):
    url = f'{API_BASE_URL}/message/sendText/{instancia}'
    data = {
        'number': numero,
        'text': texto
    }
    response = requests.post(url, json=data, headers=headers)
    return response.json()

# Uso
enviar_mensagem('minha-instancia', '5511999999999', 'Olá!')
```

## Principais Endpoints

### Instâncias

- `POST /instance/create` - Criar instância
- `GET /instance/fetchInstances` - Listar instâncias
- `POST /instance/restart/{instanceName}` - Reiniciar instância
- `POST /instance/connect/{instanceName}` - Conectar ao WhatsApp
- `GET /instance/connectionState/{instanceName}` - Status da conexão
- `DELETE /instance/delete/{instanceName}` - Deletar instância
- `DELETE /instance/logout/{instanceName}` - Desconectar instância

### Mensagens

- `POST /message/sendText/{instanceName}` - Enviar texto
- `POST /message/sendMedia/{instanceName}` - Enviar mídia
- `POST /message/sendButtons/{instanceName}` - Enviar botões
- `POST /message/sendList/{instanceName}` - Enviar lista
- `POST /message/sendLocation/{instanceName}` - Enviar localização
- `POST /message/sendContact/{instanceName}` - Enviar contato
- `POST /message/sendSticker/{instanceName}` - Enviar sticker
- `POST /message/sendAudio/{instanceName}` - Enviar áudio

### Chats

- `GET /chat/fetchChats/{instanceName}` - Listar chats
- `GET /chat/fetchMessages/{instanceName}` - Buscar mensagens
- `POST /chat/markChatUnread/{instanceName}` - Marcar como não lido
- `POST /chat/archiveChat/{instanceName}` - Arquivar chat

### Grupos

- `POST /group/create/{instanceName}` - Criar grupo
- `GET /group/fetchAllGroups/{instanceName}` - Listar grupos
- `POST /group/updateSubject/{instanceName}` - Atualizar nome do grupo
- `POST /group/updateDescription/{instanceName}` - Atualizar descrição
- `POST /group/updatePicture/{instanceName}` - Atualizar foto do grupo
- `POST /group/updateParticipant/{instanceName}` - Atualizar participante
- `POST /group/inviteCode/{instanceName}` - Obter código de convite

### Configurações

- `GET /settings/fetchSettings/{instanceName}` - Buscar configurações
- `PUT /settings/updateSettings/{instanceName}` - Atualizar configurações

## Códigos de Status HTTP

- `200 OK` - Sucesso
- `201 Created` - Criado com sucesso
- `400 Bad Request` - Requisição inválida
- `401 Unauthorized` - Não autenticado (apikey inválido ou ausente)
- `403 Forbidden` - Acesso negado
- `404 Not Found` - Recurso não encontrado
- `500 Internal Server Error` - Erro interno do servidor

## Erros Comuns

### 401 Unauthorized

```json
{
  "status": 401,
  "error": "Unauthorized"
}
```

**Solução**: Verifique se o header `apikey` está correto.

### 404 Not Found

```json
{
  "status": 404,
  "error": "Instance not found"
}
```

**Solução**: Verifique se o nome da instância está correto.

### 400 Bad Request

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid integration"
}
```

**Solução**: Verifique os parâmetros enviados na requisição.

## Integração Tipo (integration)

- `WHATSAPP-BAILEYS` (Padrão recomendado - Gratuito)
- `WHATSAPP-BUSINESS` (Requer token do Meta)
- `WHATSAPP-EVOLUTION` (Integração customizada)

## Notas Importantes

1. **Formato de Número**: Use formato internacional sem espaços ou caracteres especiais (ex: `5511999999999`)
2. **Base64 para Mídia**: Imagens devem ser enviadas em base64 com prefixo `data:image/png;base64,`
3. **Rate Limiting**: A API pode ter limitações de taxa dependendo da configuração
4. **Webhooks**: Configure webhooks no `.env` para receber eventos em tempo real

## Documentação Completa

Para mais detalhes, consulte:

- [COMO-USAR-WHATSAPP.md](./COMO-USAR-WHATSAPP.md)
- [README.md](./README.md)
