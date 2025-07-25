# Upload-Only Endpoint API

API REST simples para upload de arquivos com autenticação, usando Fastify, Prisma (SQLite) e integração com Google Drive.

---

## Descrição

Este projeto oferece uma API para upload de arquivos, onde o usuário pode enviar arquivos (um a um) e indicar um caminho (path) para armazená-los em um Google Drive configurado via .env.

Além disso, o projeto possui autenticação de usuários com diferentes níveis de permissão (admin, superadmin, etc), com rotas para login, cadastro, atualização e remoção de usuários.

Para o upload, é necessário estar autenticado com o token de um usuário. Por decisão arbitrária para meu projeto, o token não tem expiração, e é gerado um novo a cada login daquele usuário, invalidando o antigo.

---

## Tecnologias

- Node.js (ES Modules)  
- Fastify (framework web)  
- Prisma ORM com SQLite local (`db.sqlite`)  
- Google Drive API para armazenamento de arquivos  
- Autenticação JWT com roles (utilizado apenas nas rotas de usuários) e permissões  
- Logging customizado ([logging-js](https://github.com/adriankubinyete/logging-js))

---

### Modo de Uso da API

1. **Autenticação**

Faça um `POST` para `/v1/user/login` com o JSON contendo usuário e senha para obter o token do usuário:
> ⚠️ Quando o banco é criado na primeira vez, é gerado um usuário root, com senha definida pelo que está na variável `DATABASE_ROOT_PASSWORD`. Caso o banco já exista, por questão de segurança essa senha não será respeitada. Recomenda-se a remoção do banco de dados, e reconstrução do contêiner, ou correção manual.

> A partir de um usuário inicial com permissão ADMIN ou SUPERADMIN, é possível criar outros novos usuários no endpoint de registro.

```http
POST http://127.0.0.1:3000/v1/user/login
Content-Type: application/json

{
  "username": "admin",
  "password": "senha_definida_no_env"
}
```

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "token": "xxxxxxxxOiJIUwI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxbmFtZSI6InJvb3wiLCJyb2xlIjoic3VwZXJhZG1pbiIsImlhdCI6MTc1MzQ3MDc2NH0.xxxxxxxx91WR0rMfifAYiiYNOjEsr_he2wQdT8dI-_E"
}
```

2. **Realizando um upload**

Utilizando um token autenticado, envie um `POST` para `/v1/upload`, sendo este um form data contendo um arquivo, e um caminho para onde será upado no Google Drive. Somente um arquivo por requisição.

```sh
curl -X POST http://127.0.0.1:3000/v1/upload \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -F "file=@/caminho/para/seu/arquivo.png" \
  -F "path=/pasta/no/drive"
```

```
HTTP/1.1 200 OK
Content-Type: application/json

{
    "message": "File uploaded",
    "result": [
        {
            "id": "xxxxxxxxxxxg4h24nN4MEkB3dUpEUY2kK",
            "path": "/pasta/no/drive/xxxxxxxxxxxxxxx4a37e2787946dcba8.jpg"
        }
    ]
}
```

> O arquivo será salvo em `GOOGLEDRIVE:/pasta/no/drive/arquivo.png`, preservando o nome do arquivo, e o caminho no Google Drive será criado à necessidade, caso não exista as pastas "/pasta/no/drive". É importante notar que caso você esteja utilizando a variável de ambiente `GOOGLE_DRIVE_ROOT_FOLDER_ID`, o caminho `path` repassado será criado relativo à GOOGLE_DRIVE_ROOT_FOLDER_ID, ficando da seguinte forma: `GOOGLEDRIVE:[Caminho até a pasta ID GOOGLE_DRIVE_ROOT_FOLDER_ID]/PATH/FILENAME`

---

## Variáveis de ambiente (.env)

Consulte o arquivo `.env.example`.

---

## Considerações finais

refatora tudo 🤷
