export interface SseMessage {
  event: string;
  data: string;
}


export class SseParser {
  private buffer = '';
  private event = '';
  private dataLines: string[] = [];

  push(chunk: string): SseMessage[] {
    this.buffer += chunk;
    const messages: SseMessage[] = [];

    for (;;) {
      const newline = this.buffer.indexOf('\n');

      if (newline === -1) {
        break;
      }

      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);

      const message = this.processLine(line);

      if (message !== null) {
        messages.push(message);
      }
    }

    return messages;
  }

  private processLine(line: string): SseMessage | null {
  
    if (line === '') {
      if (this.dataLines.length === 0) {
        this.event = '';
        return null;
      }

      const message: SseMessage = {
        event: this.event === '' ? 'message' : this.event,
        data: this.dataLines.join('\n'),
      };

      this.event = '';
      this.dataLines = [];
      return message;
    }

 
    if (line.startsWith(':')) {
      return null;
    }

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);

    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    if (field === 'event') {
      this.event = value;
    } else if (field === 'data') {
      this.dataLines.push(value);
    }

    return null;
  }
}