# Referência Rápida de APIs: Pagamentos PIX e Recibos — Topa Tudo

Este documento apresenta a referência técnica dos módulos internos responsáveis pela geração de **Pagamentos Instantâneos PIX (BR Code EMV)**, **Cupons Térmicos Digitais (80mm HD)**, **Compartilhamento Inteligente via WhatsApp**, **Impressão A4** e **Transações RPC**.

---

## 1. API de Pagamentos PIX (`src/core/utils/pix.ts`)

O motor de pagamentos PIX implementa integralmente a especificação **EMV® QRCPS-MPM (BR Code)** do Banco Central do Brasil, operando de forma 100% local, determinística e sem dependência de APIs externas para a montagem do payload e cálculo do checksum **CRC16-CCITT** (polinômio `0x1021`, inicial `0xFFFF`).

### 1.1. Constantes Oficiais

| Constante | Valor Padrão | Descrição |
| :--- | :--- | :--- |
| `PIX_KEY_RAW` | `'59d30911-a07d-407c-8153-71ca25a9de68'` | Chave Aleatória (EVP UUID v4) oficial da Topa Tudo. |
| `PIX_KEY_FORMATTED` | `'59d30911-a07d-407c-8153-71ca25a9de68'` | Representação de exibição da chave PIX nos recibos. |
| `PIX_KEY_NAME` | `'Chave Aleatória (EVP)'` | Rótulo descritivo do tipo de chave. |
| `PIX_MERCHANT_NAME` | `'AGRIPINO ONOFRE DE PAIVA'` | Nome do titular/favorecido (máx. 25 caracteres ASCII EMV). |
| `PIX_MERCHANT_CITY` | `'BRASIL'` | Cidade do recebedor (máx. 15 caracteres ASCII EMV). |

### 1.2. `generatePixPayload(options?)`

Gera a string oficial **Pix Copia e Cola** estruturada em campos TLV (*Tag-Length-Value*) e assinada com o CRC16 no campo `63`.

```ts
interface PixPayloadOptions {
  key?: string;     // Chave PIX (default: PIX_KEY_RAW)
  name?: string;    // Nome do recebedor (default: PIX_MERCHANT_NAME)
  city?: string;    // Cidade do recebedor (default: PIX_MERCHANT_CITY)
  amount?: number;  // Valor em R$ (ex: 250.50). Omitido se <= 0
  txid?: string;    // Identificador da transação (ex: "OS00125", máx. 25 alfanuméricos, default: "***")
}

function generatePixPayload(options?: PixPayloadOptions): string
```

#### Estrutura dos Campos EMV Gerados
- `00`: Payload Format Indicator (`01`)
- `26`: Merchant Account Information (`00` = `br.gov.bcb.pix`, `01` = Chave PIX higienizada)
- `52`: Merchant Category Code (`0000`)
- `53`: Transaction Currency (`986` — Real Brasileiro BRL)
- `54`: Transaction Amount (Formatado com 2 casas decimais, ex: `150.00`)
- `58`: Country Code (`BR`)
- `59`: Merchant Name (Higienizado sem acentos, maiúsculas, até 25 chars)
- `60`: Merchant City (Higienizado sem acentos, maiúsculas, até 15 chars)
- `62`: Additional Data Field Template (`05` = `txid`, ex: `OS00042`)
- `63`: CRC16-CCITT (4 dígitos hexadecimais em caixa alta)

#### Exemplo de Uso
```ts
import { generatePixPayload, getPixQrCodeDataUrl } from '@/core/utils/pix';

const payload = generatePixPayload({
  amount: 350.00,
  txid: 'OS00042',
});

const qrCodeBase64 = await getPixQrCodeDataUrl(payload, { width: 320 });
```

### 1.3. Funções Auxiliares de PIX e QR Code

- **`cleanPixKey(key: string): string`**
  Normaliza chaves PIX conforme a regra do BACEN: preserva hífens em chaves aleatórias UUID v4 (minúsculas), mantém `+` em telefones internacionais (`+55...`), converte e-mails para minúsculas e remove pontuação de CPF/CNPJ.
- **`getPixQrCodeDataUrl(payload: string, options?: { width?: number; margin?: number }): Promise<string>`**
  Retorna uma `data:image/png;base64,...` de alta nitidez com nível de correção de erro `'M'`.
- **`getPixQrCodeSvgSync(payload: string, margin?: number): string`**
  Gera um elemento `<svg>` vetorial de forma **100% síncrona** a partir da matriz de módulos do QR Code. Ideal para injeção imediata em templates de impressão (`printOS.ts`).
- **`getPixQrCodeSvg(payload: string, options?: { margin?: number }): Promise<string>`**
  Versão assíncrona baseada em `QRCode.toString(..., { type: 'svg' })`.
- **`copyToClipboard(text: string): Promise<boolean>`**
  Copia o código Pix Copia e Cola para a área de transferência utilizando `navigator.clipboard.writeText` com fallback automático para `document.execCommand('copy')`.

---

## 2. API de Cupom Térmico Digital (`src/core/utils/thermalReceipt.ts`)

Renderiza programaticamente um comprovante estilo bobina térmica de **80mm** em **HTML5 Canvas 2D** com escala `2.5x` (largura lógica `680px` → largura física `1700px` Ultra-HD).

### 2.1. Contrato de Retorno (`GeneratedThermalReceipt`)

```ts
export interface GeneratedThermalReceipt {
  blob: Blob;       // Imagem binária (image/png) pronta para Clipboard ou Upload
  dataUrl: string;  // String Base64 (data:image/png;base64,...) para preview em <img>
  file: File;       // Objeto File ("recibo-topatudo-OS00001.png") para Web Share API
  width: number;    // Largura física em pixels (1700px)
  height: number;   // Altura física calculada dinamicamente conforme itens e textos
}
```

### 2.2. `generateThermalReceiptBlob(order, client?, tech?, items?)`

```ts
export async function generateThermalReceiptBlob(
  order: Order,
  client?: Client | null,
  tech?: Profile | null,
  items: OrderItem[] = []
): Promise<GeneratedThermalReceipt>
```

#### Pipeline de Renderização em 3 Passos
1. **Medição Dinâmica**: Calcula quebras de linha (`wrapText`) para endereço e descrição do serviço, somando a altura exata de cada seção (cabeçalho vetorial, dados do cliente/técnico, tabela de peças, bloco de totais, QR Code PIX, garantia legal CDC, assinatura digital do cliente e código de barras Code 128B).
2. **Desenho Vetorial em Alta Definição**:
   - Desenha o recorte serrilhado superior e inferior da guilhotina (`drawSerratedPaperPath`).
   - Desenha o logotipo monocromático da Topa Tudo (`drawThermalLogo`) utilizando `Path2D`.
   - Renderiza o QR Code PIX módulo a módulo (pixel-perfect, sem borramento de interpolação).
   - Incorpora a imagem da assinatura digital (`order.signature_url`) via `loadImageSafe` com timeout de segurança de `3500ms`.
   - Codifica e desenha o código de barras `OS-00001` no padrão **Code 128B** (`encodeCode128B`).
3. **Exportação Multi-Formato**: Converte o Canvas simultaneamente em `dataUrl`, `Blob` (`image/png`) e `File`.

---

## 3. API de Compartilhamento Inteligente (`src/core/utils/shareReceipt.ts`)

Orquestra o envio do cupom térmico escolhendo automaticamente a melhor experiência conforme a plataforma do operador (Smartphone vs. Desktop).

### 3.1. `shareThermalReceiptImage(file, blob, options?)`

```ts
export interface ShareReceiptOptions {
  phone?: string | null;
  clientName?: string | null;
  orderCode?: number | string | null;
  totalPrice?: number | null;
  customText?: string;
}

export type ShareResult =
  | { status: 'shared'; message: string }
  | { status: 'copied'; message: string }
  | { status: 'downloaded'; message: string }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string };

export async function shareThermalReceiptImage(
  file: File,
  blob: Blob,
  options?: ShareReceiptOptions
): Promise<ShareResult>
```

#### Estratégia de Fallback em Cascata
1. **Nível 1 — Web Share API Level 2 (`status: 'shared'`)**: Em dispositivos móveis compatíveis (`canShareFiles() === true`), aciona a gaveta nativa do Android/iOS anexando o arquivo `.png` diretamente na conversa do WhatsApp.
2. **Nível 2 — Clipboard Image + WhatsApp Web (`status: 'copied'`)**: No computador (`canCopyImageToClipboard() === true`), grava o `Blob` PNG na área de transferência via `ClipboardItem` e abre o chat do cliente no WhatsApp Web para o operador apenas pressionar `Ctrl + V`.
3. **Nível 3 — Download Automático (`status: 'downloaded'`)**: Caso o navegador bloqueie o acesso ao clipboard, realiza o download automático do `.png` e abre o chat do WhatsApp.

---

## 4. API de Mensagens WhatsApp e Impressão A4

### 4.1. Utilitários de WhatsApp e Garantia (`src/core/utils/whatsappReceipt.ts`)

| Função | Assinatura | Descrição |
| :--- | :--- | :--- |
| `generateReceiptMessage` | `(order, client?, tech?, items?) => string` | Gera o recibo completo em texto formatado para WhatsApp, incluindo itens, garantia e bloco **Pix Copia e Cola**. |
| `generateOnTheWayMessage` | `(clientName?, techName?, orderCode?, description?) => string` | Gera a mensagem rápida *"Estou a caminho"* para a Agenda e OS. |
| `openWhatsAppReceipt` | `(phone, receiptMessage) => boolean` | Higieniza o telefone (adicionando DDI `55` quando necessário) e abre `https://wa.me/...`. |
| `sanitizePhone` | `(phone?: string \| null) => string` | Normaliza números fixos (10 dígitos) e móveis (11 dígitos) para o formato internacional `55DDDNUMERO`. |
| `formatBrazilianPhone` | `(value?: string \| null) => string` | Aplica máscara dinâmica `(99) 99999-9999` em campos de formulário. |
| `calculateWarrantyEndDate` | `(startDateIso?, days = 90) => string` | Calcula a data final da garantia em formato `DD/MM/YYYY` sem desvio de fuso horário. |
| `formatPaymentMethodLabel` | `(method?: string \| null) => string` | Traduz códigos internos (`pix`, `cartao_credito`, etc.) para rótulos comerciais. |

### 4.2. Impressão A4 e Exportação PDF (`src/core/utils/printOS.ts`)

- **`generateOrderPrintHTML(order: Order, items?: OrderItem[]): string`**
  Constrói um documento HTML5 autossuficiente estilizado para folha **A4 Retrato** (`@page { size: A4 portrait; }`), contendo cabeçalho corporativo SVG, dados do cliente/técnico, tabela de materiais com origem (`Estoque` vs. `Compra Externa`), resumo financeiro, QR Code PIX vetorial síncrono, galeria de fotos Antes/Depois, Termo de Garantia Legal (Art. 26 CDC) e bloco duplo de assinaturas.
- **`printOrderService(order: Order, items?: OrderItem[]): void`**
  Abre o documento em nova janela (ou `iframe` oculto de fallback caso pop-ups estejam bloqueados) e aciona `window.print()`.

---

## 5. RPCs e Storage no Supabase (`src/core/supabase.ts`)

- **`completeWorkOrderRPC(orderId: string): Promise<CompleteOrderResult>`**
  Executa a função transacional `complete_work_order(p_order_id)` no PostgreSQL, que conclui a OS, baixa os itens do estoque e cria a transação financeira em uma única operação atômica.
- **`uploadMedia(file: File | Blob, folder = 'os'): Promise<string>`**
  Envia imagens para o bucket público `topatudo-media` e retorna a URL pública definitiva via `getStoragePublicUrl`.
