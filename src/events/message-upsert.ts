import {
  BufferJSON,
  downloadMediaMessage,
  normalizeMessageContent,
  type WAMessage,
  type WASocket,
} from 'baileys';
import { generateResponse, type IBotMessage } from '../ai/ai';
import {
  hasTransactionBySourceMessageId,
  resetDatabaseForFreshStart,
  sql,
} from '../db';
import { ALLOWED_USER_IDS } from '../config';
import { logger } from '../logger';
import { clearSheetForFreshStart } from '../spreadsheet';

const allowedIds = ALLOWED_USER_IDS;
const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const maxImageSizeBytes = 20 * 1024 * 1024;
const catatCommandPattern = /^\/catat(?:\s+([\s\S]+))?$/i;
const resetCommandPattern = /^\/reset$/i;
const destroyCommandPattern = /^\/destroy$/i;
const catatUsageText =
  'Gunakan format: /catat beli makan 25000 atau kirim foto struk dengan caption /catat.';

const parseCatatCommand = (value?: string | null) => {
  const match = value?.trim().match(catatCommandPattern);

  if (!match) {
    return null;
  }

  return match[1]?.trim() ?? '';
};

const buildProcessingErrorReply = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.toLowerCase().includes('unable to connect')) {
    return 'Maaf, provider AI belum bisa diakses dari server bot. Periksa Base URL, port, koneksi internet, atau status gateway provider di setup.';
  }

  if (process.env.NODE_ENV === 'production') {
    return 'Maaf, terjadi kesalahan saat memproses permintaan Anda.';
  }

  return `Maaf, terjadi kesalahan saat memproses permintaan Anda. Detail dev: ${message}`;
};

export const messageUpsert = async (sock: WASocket, message: WAMessage) => {
  const keyId = message.key.id;
  const remoteJid = message.key.remoteJid;
  const phoneNumber =
    message.key.remoteJidAlt?.replace(/[^0-9]/g, '') ??
    message.key.participantAlt?.replace(/[^0-9]/g, '') ??
    null;

  if (!keyId || !remoteJid) return;

  const sourceMessageId = `${remoteJid}-${keyId}`;

  await saveMessage(message, keyId, remoteJid);
  await handleBotMessage(
    sock,
    message,
    remoteJid,
    phoneNumber,
    sourceMessageId,
  );
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

  if (!msg) {
    logger.warn('Empty WhatsApp message content', {
      module: 'MessageUpsert',
      sourceMessageId,
    });
    return;
  }

  const textMessage = msg.conversation ?? msg.extendedTextMessage?.text;

  if (resetCommandPattern.test(textMessage?.trim() ?? '')) {
    try {
      await clearSheetForFreshStart();
      await sock.sendMessage(
        remoteJid,
        {
          text: 'Spreadsheet berhasil direset. Sheet sudah dikosongkan dan header transaksi dibuat ulang.',
        },
        { quoted: message },
      );
    } catch (error) {
      logger.error('Failed to reset spreadsheet from WhatsApp command', {
        module: 'MessageUpsert',
        sourceMessageId,
        error: error instanceof Error ? error.message : String(error),
      });
      await sock.sendMessage(
        remoteJid,
        { text: buildProcessingErrorReply(error) },
        { quoted: message },
      );
    }

    return;
  }

  if (destroyCommandPattern.test(textMessage?.trim() ?? '')) {
    try {
      const result = await resetDatabaseForFreshStart();
      let spreadsheetMessage =
        'Spreadsheet juga berhasil dikosongkan dan header transaksi dibuat ulang.';

      try {
        await clearSheetForFreshStart();
      } catch (error) {
        spreadsheetMessage = `Database berhasil direset, tetapi Spreadsheet belum bisa dikosongkan: ${error instanceof Error ? error.message : String(error)}`;
      }

      await sock.sendMessage(
        remoteJid,
        {
          text: [
            'Database SQLite berhasil direset ke kondisi awal.',
            `Transaksi dihapus: ${result.deletedTransactions}.`,
            `Riwayat pesan dihapus: ${result.deletedMessages}.`,
            `Job sync Spreadsheet dihapus: ${result.deletedSyncJobs}.`,
            spreadsheetMessage,
          ].join('\n'),
        },
        { quoted: message },
      );
    } catch (error) {
      logger.error('Failed to destroy local database from WhatsApp command', {
        module: 'MessageUpsert',
        sourceMessageId,
        error: error instanceof Error ? error.message : String(error),
      });
      await sock.sendMessage(
        remoteJid,
        { text: buildProcessingErrorReply(error) },
        { quoted: message },
      );
    }

    return;
  }

  const textCommand = parseCatatCommand(textMessage);
  const imageCommand = parseCatatCommand(msg.imageMessage?.caption);
  const commandText = textCommand ?? imageCommand;

  if (commandText === null) {
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

  if (!msg.imageMessage && !commandText) {
    await sock.sendMessage(
      remoteJid,
      { text: catatUsageText },
      { quoted: message },
    );
    return;
  }

  if (textCommand !== null) {
    bot = {
      message: commandText,
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
        await sock.sendMessage(
          remoteJid,
          { text: response },
          { quoted: message },
        );
        return;
      }

      bot = {
        image: {
          data: buffer.toString('base64'),
          mimeType: mimeType,
        },
        message: commandText || undefined,
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
        { text: buildProcessingErrorReply(error) },
        { quoted: message },
      );
    }
    return;
  }
};
