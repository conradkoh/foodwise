import { TelegramMessageOutgoing } from '../types';
export class TelegramMessageBuilder {
  private payload: Partial<TelegramMessageOutgoing> = {};

  constructor() {}

  public chatId(id: number | string): TelegramMessageBuilder {
    this.payload.chat_id = id;
    return this;
  }

  public text(message: string): TelegramMessageBuilder {
    this.payload.text = message;
    return this;
  }

  public parseMode(
    mode: 'MarkdownV2' | 'HTML' | 'Markdown'
  ): TelegramMessageBuilder {
    this.payload.parse_mode = mode;
    return this;
  }

  public disableWebPagePreview(disable: boolean): TelegramMessageBuilder {
    this.payload.disable_web_page_preview = disable;
    return this;
  }

  public disableNotification(disable: boolean): TelegramMessageBuilder {
    this.payload.disable_notification = disable;
    return this;
  }

  public replyToMessageId(messageId: number): TelegramMessageBuilder {
    this.payload.reply_to_message_id = messageId;
    return this;
  }

  public inlineKeyboard(
    keyboardBuilder: (kb: InlineKeyboardBuilder) => void
  ): TelegramMessageBuilder {
    const builder = new InlineKeyboardBuilder();
    keyboardBuilder(builder);
    this.payload.reply_markup = { inline_keyboard: builder.build() };
    return this;
  }

  public build(): TelegramMessageOutgoing {
    if (!this.payload.chat_id) {
      throw new Error('Chat ID is required');
    }
    if (!this.payload.text) {
      throw new Error('Message text is required');
    }
    return this.payload as TelegramMessageOutgoing;
  }
}

class InlineKeyboardBuilder {
  private keyboard: Array<Array<any>> = [];
  private currentRow: Array<any> = [];

  public addButton(button: {
    text: string;
    url?: string;
    callback_data?: string;
    web_app?: { url: string };
    login_url?: {
      url: string;
      forward_text?: string;
      bot_username?: string;
      request_write_access?: boolean;
    };
    switch_inline_query?: string;
    switch_inline_query_current_chat?: string;
    callback_game?: {};
    pay?: boolean;
  }): InlineKeyboardBuilder {
    this.currentRow.push(button);
    return this;
  }

  public newRow(): InlineKeyboardBuilder {
    if (this.currentRow.length > 0) {
      this.keyboard.push(this.currentRow);
      this.currentRow = [];
    }
    return this;
  }

  public build(): Array<Array<any>> {
    if (this.currentRow.length > 0) {
      this.keyboard.push(this.currentRow);
    }
    return this.keyboard;
  }
}
