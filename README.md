# Revisor de Currículo e LinkedIn com IA

Aplicação web que revisa currículos com apoio de um LLM. A pessoa cola o texto do currículo (e, opcionalmente, a descrição da vaga) e recebe uma **nota**, **pontos fortes**, **problemas** e **sugestões de melhoria**, com a resposta chegando em **streaming**.

> 🚧 Projeto em construção. Este README será expandido na última etapa (prints, decisões técnicas e "o que eu faria diferente").

## Stack

| Camada    | Tecnologias                                  |
| --------- | -------------------------------------------- |
| Front-end | Angular + TypeScript                         |
| Back-end  | Node.js + Express + TypeScript               |
| IA        | API de LLM, chamada **apenas** pelo back-end |

## Estrutura do repositório

```
.
├── client/   # Aplicação Angular (interface)
├── server/   # API Express (integração com o LLM)
├── .gitignore
└── README.md
```

## Segurança da chave de API

A chave do LLM fica somente no back-end, em variável de ambiente.

1. Copie o modelo: `cp server/.env.example server/.env`
2. Preencha os valores no arquivo `server/.env`
3. O `.env` real está no `.gitignore` e **nunca** deve ser commitado

## Roadmap

- [x] 1. Estrutura do repo, README inicial, `.gitignore`
- [x] 2. Servidor Express + TS com health check
- [x] 3. Integração com o LLM e endpoint de revisão
- [x] 4. Validação, limites e erros
- [x] 5. Streaming (SSE)
- [ ] 6. Angular: layout e formulário
- [ ] 7. Angular: serviço HTTP, consumo do streaming, loading/erro
- [ ] 8. Testes (back e front)
- [ ] 9. CI com GitHub Actions
- [ ] 10. Deploy e README final

## Como rodar

As instruções de execução serão adicionadas conforme o servidor (etapa 2) e o cliente (etapa 6) forem criados.