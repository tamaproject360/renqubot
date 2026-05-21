import {
  BufferJSON,
  downloadMediaMessage,
  normalizeMessageContent,
  type WAMessage,
  type WASocket,
} from 'baileys';
import { generateResponse, type IBotMessage } from '../ai/ai';
import { hasTransactionBySourceMessageId, sql } from '../db';
import { ALLOWED_USER_IDS } from '../config';
import { logger } from '../logger';

const allowedIds = ALLOWED_USER_IDS;
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageSizeBytes = 20 * 1024 * 1024;

export const messageUpsert = async (sock: WASocket, message: WAMessage) => {
  const keyId = message.key.id;
  const remoteJid = message.key.remoteJid;
  const phoneNumber =
    message.key.remoteJidAlt?.replace(/[^0-9]/g, '') ??
    message.key.participantAlt?.replace(/[^0-9]/g, '') ??
    null;

  if (!keyId || !remoteJid) return;

  if (message.key.fromMe) return;

  const sourceMessageId = `${remoteJid}-${keyId}`;

  await Promise.all([
    saveMessage(message, keyId, remoteJid),
    handleBotMessage(sock, message, remoteJid, phoneNumber, sourceMessageId),
  ]);
};

const saveMessage = async (
  message: WAMessage,
  keyId: string,
  remoteJid: string,
) => {
  const data = {
    id: `${remoteJid}-${keyId}`,
    data: JSON.stringify(message.message, BufferJSON.replacer),
  };

  return await sql`INSERT INTO
    messages ${sql(data)}
  ON CONFLICT (id)
  DO UPDATE SET
    data = EXCLUDED.data,
    updated_at = unixepoch();
  `;
};

const handleBotMessage = async (
  sock: WASocket,
  message: WAMessage,
  remoteJid: string,
  phoneNumber: string | null,
  sourceMessageId: string,
) => {
  const msg = normalizeMessageContent(message.message);

  if (
    phoneNumber &&
    allowedIds.length > 0 &&
    !allowedIds.includes(phoneNumber)
  ) {
    logger.warn('Unauthorized WhatsApp sender ignored', {
      module: 'MessageUpsert',
      sender: phoneNumber,
    });
    return;
  }

  if (await hasTransactionBySourceMessageId(sourceMessageId)) {
    await sock.sendMessage(
      remoteJid,
      { text: 'Transaksi dari pesan ini sudah pernah dicatat sebelumnya.' },
      { quoted: message },
    );
    return;
  }

  await sock.sendPresenceUpdate('available', remoteJid);

  await Bun.sleep(1000);

  let bot: IBotMessage | null = null;
  let response: string | null = null;

  if (!msg) {
    logger.warn('Empty WhatsApp message content', {
      module: 'MessageUpsert',
      sourceMessageId,
    });
    return;
  }

  if (msg.conversation) {
    bot = {
      message: msg.conversation,
    };
  }

  if (msg.extendedTextMessage?.text) {
    bot = {
      message: msg.extendedTextMessage.text,
    };
  }

  if (msg.imageMessage) {
    try {
      logger.info('Image message received', {
        module: 'MessageUpsert',
        sourceMessageId,
      });

      const buffer = await downloadMediaMessage(
        message,
        'buffer',
        {},
        {
          logger: sock.logger,
          reuploadRequest: sock.updateMediaMessage,
        },
      );

      const mimeType = msg.imageMessage.mimetype || 'image/jpeg';

      if (!allowedImageMimeTypes.has(mimeType)) {
        response =
          'Maaf, format gambar belum didukung. Kirim gambar JPEG, PNG, atau WebP.';
      } else if (buffer.length > maxImageSizeBytes) {
        response =
          'Maaf, ukuran gambar terlalu besar. Maksimal gambar yang bisa diproses adalah 20 MB.';
      }

      if (response) {
        await sock.readMessages([message.key]);
        await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
        return;
      }

      bot = {
        image: {
          data: buffer.toString('base64'),
          mimeType: mimeType,
        },
        message: msg.imageMessage.caption || undefined,
      };
    } catch (error) {
      logger.error('Failed to download image message', {
        module: 'MessageUpsert',
        sourceMessageId,
        error: error instanceof Error ? error.message : String(error),
      });
      response = 'Maaf, terjadi kesalahan saat memproses gambar Anda.';
    }
  }

  await sock.readMessages([message.key]);

  await Bun.sleep(1000);

  if (response) {
    await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
    return;
  }

  if (bot) {
    try {
      const botResponse = await generateResponse(bot, {
        sourceMessageId,
        sender: phoneNumber,
      });
      if (!botResponse) {
        logger.warn('No bot response generated', {
          module: 'MessageUpsert',
          sourceMessageId,
        });
        await sock.sendMessage(
          remoteJid,
          { text: 'Maaf, saya tidak dapat memberikan respons saat ini.' },
          { quoted: message },
        );
        return;
      }

      await sock.sendMessage(
        remoteJid,
        { text: botResponse.reply_text },
        { quoted: message },
      );
    } catch (error) {
      logger.error('Failed to generate bot response', {
        module: 'MessageUpsert',
        sourceMessageId,
        error: error instanceof Error ? error.message : String(error),
      });
      await sock.sendMessage(
        remoteJid,
        { text: 'Maaf, terjadi kesalahan saat memproses permintaan Anda.' },
        { quoted: message },
      );
    }
    return;
  }
};
