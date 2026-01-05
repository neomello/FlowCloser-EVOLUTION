# Como Usar o Evolution API com WhatsApp

Este guia explica como configurar e usar o Evolution API para conectar e gerenciar conexões WhatsApp.

## Pré-requisitos

- Node.js 20+ instalado
- PostgreSQL ou MySQL configurado
- Redis (opcional, mas recomendado)
- Conta WhatsApp para conectar

## Instalação

### 1. Configurar o Ambiente

Copie o arquivo de exemplo e configure as variáveis:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Servidor
SERVER_NAME=evolution
SERVER_TYPE=http
SERVER_PORT=8080

# Banco de Dados (escolha PostgreSQL ou MySQL)
DATABASE_PROVIDER=postgresql  # ou mysql
DATABASE_CONNECTION_URI=postgresql://usuario:senha@localhost:5432/evolution_api

# Autenticação
AUTHENTICATION_API_KEY=sua-chave-secreta-aqui

# Cache Redis (opcional)
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://localhost:6379
```

### 2. Configurar o Banco de Dados

Primeiro, defina o provider do banco:

```bash
export DATABASE_PROVIDER=postgresql  # ou mysql
```

Gere o cliente Prisma:

```bash
npm run db:generate
```

Execute as migrações:

```bash
# Desenvolvimento
npm run db:migrate:dev

# Produção
npm run db:deploy
```

### 3. Instalar Dependências e Iniciar

```bash
npm install
npm run build
npm start
```

## Uso Básico

### Criando uma Instância WhatsApp

Uma instância representa uma conexão WhatsApp. Você pode criar múltiplas instâncias para diferentes números.

#### Endpoint: Criar Instância

```http
POST /instance/create
Content-Type: application/json
apikey: sua-chave-secreta-aqui

{
  "instanceName": "minha-instancia",
  "token": "token-opcional-para-qrcode",
  "qrcode": true,
  "integration": "WHATSAPP-BAILEYS"
}
```

**Parâmetros:**

- `instanceName`: Nome único para identificar a instância
- `token`: Token opcional para autenticação do QR code
- `qrcode`: Se `true`, retorna QR code para escanear
- `integration`: Tipo de integração (`WHATSAPP-BAILEYS`, `WHATSAPP-BUSINESS`, `WHATSAPP-EVOLUTION`)

**Resposta de Sucesso:**

```json
{
  "status": 201,
  "qrcode": {
    "code": "data:image/png;base64,...",
    "base64": "..."
  },
  "base64": "...",
  "instance": {
    "instanceName": "minha-instancia",
    "instanceId": "uuid-da-instancia"
  }
}
```

### Conectando ao WhatsApp

#### Método 1: QR Code (Baileys)

1. **Criar a instância com QR code:**

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: sua-chave-secreta-aqui" \
  -d '{
    "instanceName": "minha-instancia",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

1. **Escaneie o QR code:**
   - A resposta contém o QR code em base64
   - Abra o WhatsApp no seu celular
   - Vá em Configurações > Aparelhos conectados > Conectar um aparelho
   - Escaneie o QR code retornado

2. **Verificar status da conexão:**

```bash
curl http://localhost:8080/instance/fetchInstances \
  -H "apikey: sua-chave-secreta-aqui"
```

#### Método 2: WhatsApp Business API (Meta)

Para usar a API oficial do WhatsApp Business, você precisa:

1. Configurar no `.env`:

```env
WA_BUSINESS_TOKEN_WEBHOOK=seu-token
WA_BUSINESS_URL=https://graph.facebook.com
WA_BUSINESS_VERSION=v18.0
```

1. Criar instância:

```json
{
  "instanceName": "business-instance",
  "integration": "WHATSAPP-BUSINESS",
  "token": "seu-token-do-meta",
  "number": "numero-do-whatsapp-business"
}
```

### Enviando Mensagens

#### Enviar Mensagem de Texto

```http
POST /message/sendText/minha-instancia
Content-Type: application/json
apikey: sua-chave-secreta-aqui

{
  "number": "5511999999999",
  "text": "Olá! Esta é uma mensagem de teste."
}
```

#### Enviar Imagem

```http
POST /message/sendMedia/minha-instancia
Content-Type: application/json
apikey: sua-chave-secreta-aqui

{
  "number": "5511999999999",
  "mediatype": "image",
  "media": "data:image/png;base64,iVBORw0KG...",
  "caption": "Legenda da imagem"
}
```

#### Enviar Documento

```http
POST /message/sendMedia/minha-instancia
Content-Type: application/json
apikey: sua-chave-secreta-aqui

{
  "number": "5511999999999",
  "mediatype": "document",
  "media": "data:application/pdf;base64,JVBERi0...",
  "fileName": "documento.pdf"
}
```

#### Enviar Áudio

```http
POST /message/sendWhatsAppAudio/minha-instancia
Content-Type: application/json
apikey: sua-chave-secreta-aqui

{
  "number": "5511999999999",
  "audio": "data:audio/mp3;base64,SUQzBAAAA..."
}
```

### Recebendo Mensagens

#### Configurar Webhook

Para receber mensagens, configure um webhook:

```http
POST /webhook/set/minha-instancia
Content-Type: application/json
apikey: sua-chave-secreta-aqui

{
  "webhook": {
    "enabled": true,
    "url": "https://seu-servidor.com/webhook",
    "events": [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "SEND_MESSAGE"
    ]
  }
}
```

#### Eventos Disponíveis

- `MESSAGES_UPSERT`: Nova mensagem recebida
- `MESSAGES_UPDATE`: Status da mensagem atualizado (entregue, lida, etc)
- `SEND_MESSAGE`: Mensagem enviada
- `CONNECTION_UPDATE`: Status da conexão alterado
- `QRCODE_UPDATED`: QR code atualizado

#### Exemplo de Payload do Webhook

Quando uma mensagem é recebida, você receberá:

```json
{
  "event": "messages.upsert",
  "instance": "minha-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0123456789ABCDEF"
    },
    "message": {
      "conversation": "Olá! Como você está?"
    },
    "messageType": "conversation",
    "messageTimestamp": 1234567890,
    "pushName": "Nome do Contato"
  }
}
```

### Gerenciando Instâncias

#### Listar Todas as Instâncias

```http
GET /instance/fetchInstances
apikey: sua-chave-secreta-aqui
```

#### Obter Status de uma Instância

```http
GET /instance/fetchInstance/minha-instancia
apikey: sua-chave-secreta-aqui
```

#### Deletar uma Instância

```http
DELETE /instance/delete/minha-instancia
apikey: sua-chave-secreta-aqui
```

#### Reiniciar Conexão

```http
PUT /instance/restart/minha-instancia
apikey: sua-chave-secreta-aqui
```

#### Desconectar

```http
PUT /instance/logout/minha-instancia
apikey: sua-chave-secreta-aqui
```

## Funcionalidades Avançadas

### Grupos

#### Criar Grupo

```http
POST /group/create/minha-instancia
Content-Type: application/json
apikey: sua-chave-secreta-aqui

{
  "subject": "Nome do Grupo",
  "participants": ["5511999999999@s.whatsapp.net"]
}
```

#### Adicionar Participantes

```http
PUT /group/updateParticipants/minha-instancia
Content-Type: application/json
apikey: sua-chave-secreta-aqui

{
  "groupId": "120363123456789012@g.us",
  "participants": ["5511888888888@s.whatsapp.net"],
  "action": "add"
}
```

### Contatos

#### Verificar se Número Está no WhatsApp

```http
GET /chat/fetchContacts/minha-instancia?where={"remoteJid":"5511999999999@s.whatsapp.net"}
apikey: sua-chave-secreta-aqui
```

### Status/Stories

#### Enviar Status

```http
POST /message/sendStatus/minha-instancia
Content-Type: application/json
apikey: sua-chave-secreta-aqui

{
  "mediatype": "image",
  "media": "data:image/png;base64,...",
  "caption": "Meu status"
}
```

## Integração com Chatbots

O Evolution API suporta integração com vários chatbots:

### OpenAI

Configure no `.env`:

```env
OPENAI_ENABLED=true
OPENAI_API_KEY_GLOBAL=sua-chave-openai
```

### Typebot, Chatwoot, Dify, etc

Veja a documentação completa em: <https://doc.evolution-api.com>

## Autenticação

Todas as requisições devem incluir o header:

```
apikey: sua-chave-secreta-aqui
```

A chave API está configurada no `.env` como `AUTHENTICATION_API_KEY`.

## Exemplos de Uso com cURL

### Exemplo Completo: Enviar Mensagem

```bash
# 1. Criar instância
INSTANCE_NAME="minha-instancia"
API_KEY="sua-chave-secreta-aqui"

curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d "{
    \"instanceName\": \"$INSTANCE_NAME\",
    \"qrcode\": true,
    \"integration\": \"WHATSAPP-BAILEYS\"
  }"

# 2. Escanear QR code no celular

# 3. Verificar conexão
curl http://localhost:8080/instance/fetchInstance/$INSTANCE_NAME \
  -H "apikey: $API_KEY"

# 4. Enviar mensagem
curl -X POST http://localhost:8080/message/sendText/$INSTANCE_NAME \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "number": "5511999999999",
    "text": "Olá do Evolution API!"
  }'
```

## Troubleshooting

### Instância não conecta

1. Verifique se o servidor está rodando
2. Confirme que o QR code foi escaneado
3. Verifique os logs do servidor
4. Tente reiniciar a instância: `PUT /instance/restart/nome-instancia`

### Mensagens não são enviadas

1. Verifique se a instância está conectada (status: "open")
2. Confirme que o número está no formato correto: `5511999999999`
3. Verifique a autenticação (header `apikey`)
4. Consulte os logs do servidor

### Erro de autenticação

- Verifique se o header `apikey` está correto
- Confirme a chave no arquivo `.env`

## Recursos Adicionais

- **Documentação Completa**: <https://doc.evolution-api.com>
- **Postman Collection**: <https://evolution-api.com/postman>
- **Grupo WhatsApp**: <https://evolution-api.com/whatsapp>
- **Discord**: <https://evolution-api.com/discord>

## Notas Importantes

⚠️ **Atenção**:

- O WhatsApp não permite bots ou clientes não oficiais. Use por sua conta e risco.
- O método Baileys (WhatsApp Web) pode ter limitações comparado à API oficial
- Para produção, considere usar a WhatsApp Business API oficial
- Mantenha suas chaves API seguras e não as compartilhe

## Suporte

Para suporte e dúvidas:

- Abra uma issue no GitHub
- Entre no grupo WhatsApp da comunidade
- Acesse o Discord
