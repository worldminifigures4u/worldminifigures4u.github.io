# Cloudinary signed upload

Esta função substitui o upload unsigned direto do browser por upload assinado.

## Secrets necessários no Supabase

Guardar estes valores como secrets da Edge Function/projeto:

- `CLOUDINARY_CLOUD_NAME=ddzgmr4eb`
- `CLOUDINARY_API_KEY=...`
- `CLOUDINARY_API_SECRET=...`
- `CLOUDINARY_FOLDER=worldminifigures4u`
- `ADMIN_EMAILS=worldminifigures4u@gmail.com`

Nunca colocar `CLOUDINARY_API_SECRET` em ficheiros `.js`, HTML, GitHub ou chat.

## Deploy com Supabase CLI

```powershell
supabase login
supabase secrets set CLOUDINARY_CLOUD_NAME=ddzgmr4eb CLOUDINARY_API_KEY=COLOCAR_AQUI CLOUDINARY_API_SECRET=COLOCAR_AQUI CLOUDINARY_FOLDER=worldminifigures4u ADMIN_EMAILS=worldminifigures4u@gmail.com --project-ref gksndzxadndrsynvzgzb
supabase functions deploy cloudinary-sign-upload --project-ref gksndzxadndrsynvzgzb
```

Depois do deploy e teste, o site pode deixar de usar `CLOUDINARY_UPLOAD_PRESET` e passar a pedir assinatura a:

`https://gksndzxadndrsynvzgzb.supabase.co/functions/v1/cloudinary-sign-upload`

## Cloudinary

Quando o upload assinado estiver confirmado no site:

1. Desativar ou apagar o upload preset unsigned `worldminifigures4u_unsigned`.
2. Manter uploads de produto apenas via Gestão autenticada.
3. Confirmar que fotos JPG/PNG/WebP continuam a entrar na pasta `worldminifigures4u`.