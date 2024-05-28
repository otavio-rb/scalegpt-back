# Scale GPT Backend Application

## Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:
- Node.js v18
- Docker
- MongoDB
- Mongo Express

## Configuração Inicial

### Configurar Variáveis de Ambiente

Primeiro, configure as variáveis de ambiente necessárias para o projeto. Copie o arquivo `.env.example` para um novo arquivo chamado `.env` na raiz do projeto e preencha com os valores apropriados.

### Instalação de Dependências

Execute o seguinte comando para instalar todas as dependências necessárias do projeto:

```bash
npm install
```

### Configuração do Docker

Para configurar e iniciar o MongoDB e Mongo Express, use o Docker Compose com o seguinte comando:

```bash
docker-compose up -d
```
Isso irá inicializar os contêineres necessários em segundo plano.

### Configurando o Banco de Dados
Após iniciar o MongoDB e Mongo Express com Docker, crie um banco de dados chamado test através da interface do Mongo Express acessando:

```
http://localhost:8081
```
usuário: root
senha: example

### Instalação do Serverless Localmente
Para trabalhar com funções Lambda localmente, instale o Serverless Framework com o comando:

```bash
npm install -g serverless
```

### Iniciando o Projeto
Para iniciar o projeto localmente, utilize:

```bash
serverless offline
```

Isso irá subir o ambiente de desenvolvimento local no qual as funções Lambda podem ser testadas através de requisições HTTP.

### Acessando a Aplicação
Acesse a aplicação através da seguinte URL:
```bash
http://localhost:3000/dev/test
```

Você deverá receber uma resposta como:
```json
{
    "error": "Endpoint não encontrado"
}
```
Com status 404, indicando que o endpoint específico não existe.



## Deploy
Para fazer deploy do serverless na aws, primeiramente você precisa configurar suas credenciais com comando:

```bash
aws configure
```

Em seguida pode fazer o deploy com comando:

```bash
serverless deploy --stage prod --region us-east-1 --verbose
```

### Suporte
Para mais informações ou suporte, entre em contato com a equipe de desenvolvimento.






