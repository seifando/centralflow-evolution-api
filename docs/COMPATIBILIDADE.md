# Compatibilidade

Use os commits e versões fixados em upstream.json. Não há promessa de compatibilidade universal com outros forks/versões. O CentralFlow PHP deve ser 0.6.0 ou superior, com banco atualizado. O CI não conecta uma conta real ao WhatsApp.

**Evolution API 2.3.7 / Baileys 7.0.0-rc.9**: as rotas adicionais usam os guards de autenticação/instância originais. A descoberta de canais faz uma consulta MEX autenticada, limitada a 500 registros normalizados por retorno. Mudanças do protocolo WhatsApp podem exigir ajustes.
